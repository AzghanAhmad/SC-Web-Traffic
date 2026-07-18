using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SCWebTraffic.Application;
using SCWebTraffic.Domain;
using SCWebTraffic.Infrastructure.Geo;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace SCWebTraffic.Infrastructure;

public sealed class TrafficDbContext(DbContextOptions<TrafficDbContext> options) : DbContext(options), ITrafficDbContext
{
    public DbSet<Site> SitesSet => Set<Site>();
    public DbSet<Visitor> VisitorsSet => Set<Visitor>();
    public DbSet<Session> SessionsSet => Set<Session>();
    public DbSet<TrafficEvent> EventsSet => Set<TrafficEvent>();
    public DbSet<PageView> PageViewsSet => Set<PageView>();
    public DbSet<Conversion> ConversionsSet => Set<Conversion>();
    public DbSet<HeatmapData> HeatmapDataSet => Set<HeatmapData>();
    public DbSet<DailySnapshot> DailySnapshotsSet => Set<DailySnapshot>();
    public DbSet<AppUser> AppUsersSet => Set<AppUser>();

    IQueryable<Site> ITrafficDbContext.Sites => SitesSet.AsQueryable();
    IQueryable<Visitor> ITrafficDbContext.Visitors => VisitorsSet.AsQueryable();
    IQueryable<Session> ITrafficDbContext.Sessions => SessionsSet.AsQueryable();
    IQueryable<TrafficEvent> ITrafficDbContext.Events => EventsSet.AsQueryable();
    IQueryable<PageView> ITrafficDbContext.PageViews => PageViewsSet.AsQueryable();
    IQueryable<Conversion> ITrafficDbContext.Conversions => ConversionsSet.AsQueryable();
    IQueryable<HeatmapData> ITrafficDbContext.HeatmapData => HeatmapDataSet.AsQueryable();
    IQueryable<DailySnapshot> ITrafficDbContext.DailySnapshots => DailySnapshotsSet.AsQueryable();
    IQueryable<AppUser> ITrafficDbContext.AppUsers => AppUsersSet.AsQueryable();

    public new Task AddAsync<T>(T entity, CancellationToken cancellationToken = default) where T : class =>
        Set<T>().AddAsync(entity, cancellationToken).AsTask();

    public Task AddRangeAsync<T>(IEnumerable<T> entities, CancellationToken cancellationToken = default) where T : class =>
        Set<T>().AddRangeAsync(entities, cancellationToken);

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<TrafficEvent>(e =>
        {
            e.ToTable("Events");
            e.Property(x => x.Metadata).HasColumnType("json");
            e.HasIndex(x => new { x.SiteId, x.Timestamp });
            e.HasIndex(x => x.SessionId);
        });

        modelBuilder.Entity<Session>(e =>
        {
            e.HasIndex(x => new { x.SiteId, x.StartedAt });
            e.HasIndex(x => x.LastActivityAt);
        });

        modelBuilder.Entity<PageView>(e =>
        {
            e.HasIndex(x => new { x.SiteId, x.Timestamp });
            e.HasIndex(x => x.SessionId);
        });

        modelBuilder.Entity<Conversion>(e =>
        {
            e.HasIndex(x => new { x.SiteId, x.Timestamp });
        });

        modelBuilder.Entity<HeatmapData>(e =>
        {
            // Do not index full PageUrl (varchar 1024 × utf8mb4) in one key — exceeds MySQL max index length (3072 bytes).
            e.HasIndex(x => new { x.SiteId, x.Timestamp });
        });

        modelBuilder.Entity<DailySnapshot>(e =>
        {
            e.HasIndex(x => new { x.SiteId, x.Date }).IsUnique();
        });

        modelBuilder.Entity<Site>(e =>
        {
            // Hot lookup path: every /api/collect call resolves siteId via tracking key.
            e.HasIndex(x => x.TrackingKey).IsUnique();
        });
    }
}

public sealed class SchemaInitializer(
    TrafficDbContext dbContext,
    ILogger<SchemaInitializer> logger) : ISchemaInitializer
{
    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await dbContext.Database.MigrateAsync(cancellationToken);
        logger.LogInformation("Database migrations applied.");

        // Backfill tracking keys for sites created before the column existed.
        var sitesNeedingKey = await dbContext.SitesSet
            .Where(s => s.TrackingKey == null || s.TrackingKey == string.Empty)
            .ToListAsync(cancellationToken);
        if (sitesNeedingKey.Count > 0)
        {
            foreach (var s in sitesNeedingKey)
                s.TrackingKey = NewTrackingKey();
            await dbContext.SaveChangesAsync(cancellationToken);
            logger.LogInformation("Backfilled tracking keys for {Count} site(s).", sitesNeedingKey.Count);
        }
    }

    private static string NewTrackingKey()
    {
        Span<byte> buf = stackalloc byte[24];
        System.Security.Cryptography.RandomNumberGenerator.Fill(buf);
        var s = Convert.ToBase64String(buf).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return "sc_live_" + s;
    }
}

public sealed class TokenService(IConfiguration configuration) : ITokenService
{
    public AuthResponse CreateToken(AppUser user)
    {
        var secret = configuration["Jwt:Secret"] ?? "change-me-in-production";
        var issuer = configuration["Jwt:Issuer"] ?? "SCWebTraffic";
        var audience = configuration["Jwt:Audience"] ?? "SCWebTraffic.Client";
        var expiryMinutes = int.TryParse(configuration["Jwt:ExpiryMinutes"], out var min) ? min : 120;
        var expiresAt = DateTime.UtcNow.AddMinutes(expiryMinutes);

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims:
            [
                new Claim(JwtRegisteredClaimNames.Sub, user.UserId.ToString()),
                new Claim(JwtRegisteredClaimNames.Email, user.Email),
                new Claim("display_name", user.DisplayName ?? string.Empty),
                new Claim(ClaimTypes.Role, user.Role)
            ],
            expires: expiresAt,
            signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));

        return new AuthResponse(new JwtSecurityTokenHandler().WriteToken(token), expiresAt);
    }
}

internal static class TrafficAttribution
{
    public static bool IsUnattributed(string? source)
    {
        if (string.IsNullOrWhiteSpace(source)) return true;
        return source.Equals("direct", StringComparison.OrdinalIgnoreCase)
               || source.Equals("none", StringComparison.OrdinalIgnoreCase);
    }

    public static string PreferDisplaySource(string? source, string? referrer)
    {
        if (!IsUnattributed(source))
            return PrettySourceLabel(source!);

        var host = HostFromUrl(referrer);
        if (!string.IsNullOrWhiteSpace(host))
            return PrettySourceLabel(host);

        return "Direct traffic";
    }

    public static string? HostFromUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url)) return null;
        if (!Uri.TryCreate(url.Trim(), UriKind.Absolute, out var uri)) return null;
        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps) return null;
        var host = uri.Host?.Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(host)) return null;
        if (host.StartsWith("www.", StringComparison.Ordinal)) host = host[4..];
        return host;
    }

    public static string PrettySourceLabel(string raw)
    {
        var s = (raw ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(s)) return string.Empty;
        if (s.StartsWith("www.", StringComparison.Ordinal)) s = s[4..];
        return s switch
        {
            "google" or "google.com" or "google.co.uk" or "google.ca" => "Google",
            "bing" or "bing.com" => "Bing",
            "yahoo" or "yahoo.com" => "Yahoo",
            "facebook" or "facebook.com" or "fb.com" or "m.facebook.com" or "l.facebook.com" => "Facebook",
            "instagram" or "instagram.com" or "l.instagram.com" => "Instagram",
            "twitter" or "twitter.com" or "x.com" or "t.co" => "X / Twitter",
            "linkedin" or "linkedin.com" or "lnkd.in" => "LinkedIn",
            "youtube" or "youtube.com" or "youtu.be" => "YouTube",
            "reddit" or "reddit.com" => "Reddit",
            "tiktok" or "tiktok.com" => "TikTok",
            "pinterest" or "pinterest.com" => "Pinterest",
            "duckduckgo" or "duckduckgo.com" => "DuckDuckGo",
            "localhost" or "127.0.0.1" => "Local / Dev",
            _ => char.ToUpperInvariant(s[0]) + (s.Length > 1 ? s[1..] : string.Empty)
        };
    }

    /// <summary>
    /// Reads campaign name from ?utm_campaign= or ?campaign= (e.g. /catalog?campaign=Flash%20Friday).
    /// </summary>
    public static string? CampaignFromPageUrl(string? pageUrl)
    {
        if (string.IsNullOrWhiteSpace(pageUrl) || !Uri.TryCreate(pageUrl.Trim(), UriKind.Absolute, out var uri))
            return null;
        var query = uri.Query;
        if (string.IsNullOrEmpty(query)) return null;

        string? utm = null;
        string? campaign = null;
        foreach (var part in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var eq = part.IndexOf('=');
            var key = Uri.UnescapeDataString(eq >= 0 ? part[..eq] : part).Trim();
            var val = eq >= 0
                ? Uri.UnescapeDataString(part[(eq + 1)..].Replace('+', ' ')).Trim()
                : string.Empty;
            if (string.IsNullOrEmpty(val)) continue;
            if (key.Equals("utm_campaign", StringComparison.OrdinalIgnoreCase)) utm = val;
            else if (key.Equals("campaign", StringComparison.OrdinalIgnoreCase)) campaign = val;
        }

        return !string.IsNullOrWhiteSpace(utm) ? utm : campaign;
    }
}

public sealed class EventCollectionService(ITrafficDbContext db, IIpCountryResolver countryResolver) : IEventCollectionService
{
    public async Task<EventCollectionResult> CollectAsync(
        CollectEventRequest request,
        string ipAddress,
        string userAgent,
        string? referrer,
        CancellationToken cancellationToken = default,
        string? countryCodeHint = null)
    {
        // Resolve which site this event belongs to. TrackingKey is preferred (the public-by-design
        // identifier baked into the JS snippet on author websites). SiteId is supported for
        // first-party server-to-server callers.
        Guid siteId;
        if (!string.IsNullOrWhiteSpace(request.TrackingKey))
        {
            var key = request.TrackingKey.Trim();
            var matched = await db.Sites
                .AsNoTracking()
                .Where(x => x.TrackingKey == key)
                .Select(x => (Guid?)x.SiteId)
                .FirstOrDefaultAsync(cancellationToken);
            if (!matched.HasValue) throw new InvalidOperationException("Invalid trackingKey.");
            siteId = matched.Value;
        }
        else
        {
            if (request.SiteId == Guid.Empty)
                throw new InvalidOperationException("trackingKey or siteId is required.");
            var siteExists = await db.Sites.AnyAsync(x => x.SiteId == request.SiteId, cancellationToken);
            if (!siteExists) throw new InvalidOperationException("Invalid siteId.");
            siteId = request.SiteId;
        }

        var now = request.Timestamp?.ToUniversalTime() ?? DateTime.UtcNow;
        var anonId = ResolveVisitorKey(request, ipAddress, userAgent);
        var visitor = await db.Visitors
            .OrderByDescending(x => x.LastSeenAt)
            .FirstOrDefaultAsync(x => x.SiteId == siteId && x.AnonymousId == anonId, cancellationToken);

        if (visitor is null)
        {
            visitor = new Visitor
            {
                SiteId = siteId,
                AnonymousId = anonId,
                FirstSeenAt = now,
                LastSeenAt = now
            };
            await db.AddAsync(visitor, cancellationToken);
        }
        else
        {
            visitor.LastSeenAt = now;
        }

        var detectedDevice = DetectDevice(userAgent, request.Metadata);
        var session = await db.Sessions
            .OrderByDescending(x => x.LastActivityAt)
            .FirstOrDefaultAsync(x => x.SiteId == siteId && x.VisitorId == visitor.VisitorId && x.EndedAt == null, cancellationToken);

        // Same account on a different device (e.g. desktop → mobile login) must start a new
        // session so Device Insights counts Mobile/Tablet separately instead of sticking to Desktop.
        var sessionTimedOut = session is not null && session.LastActivityAt < DateTime.UtcNow.AddMinutes(-30);
        var deviceChanged = session is not null && session.DeviceType != detectedDevice
            && detectedDevice != DeviceType.Unknown;

        if (session is null || sessionTimedOut || deviceChanged)
        {
            if (session is not null && session.EndedAt == null)
                session.EndedAt = now;

            var metaCountry = TryMetadataCountryCode(request.Metadata);
            var country = await countryResolver
                .ResolveAsync(ipAddress, countryCodeHint, metaCountry, cancellationToken)
                .ConfigureAwait(false);
            var attr = ResolveSource(request.Metadata, referrer);
            var refUrl = ResolveReferrerUrl(request.Metadata, referrer);
            session = new Session
            {
                SiteId = siteId,
                VisitorId = visitor.VisitorId,
                StartedAt = now,
                LastActivityAt = now,
                DeviceType = detectedDevice,
                Country = country,
                Referrer = refUrl,
                Source = string.IsNullOrWhiteSpace(attr.Source) ? "direct" : attr.Source,
                Medium = attr.Medium,
                Campaign = ExtractCampaign(request.Metadata, request.PageUrl)
            };
            await db.AddAsync(session, cancellationToken);
        }
        else
        {
            session.LastActivityAt = now;
            // Upgrade attribution if the session was opened as direct but later pageviews carry UTM/referrer.
            if (TrafficAttribution.IsUnattributed(session.Source))
            {
                var attr = ResolveSource(request.Metadata, referrer);
                if (!TrafficAttribution.IsUnattributed(attr.Source))
                {
                    session.Source = attr.Source;
                    session.Medium = attr.Medium;
                }
                var refUrl = ResolveReferrerUrl(request.Metadata, referrer);
                if (string.IsNullOrWhiteSpace(session.Referrer) && !string.IsNullOrWhiteSpace(refUrl))
                    session.Referrer = refUrl;
            }
            if (string.IsNullOrWhiteSpace(session.Campaign))
            {
                var camp = ExtractCampaign(request.Metadata, request.PageUrl);
                if (!string.IsNullOrWhiteSpace(camp)) session.Campaign = camp;
            }
        }

        var safeMetadata = JsonSerializer.Serialize(request.Metadata ?? new Dictionary<string, object?>());
        var eventName = request.Metadata?.TryGetValue("eventName", out var n) == true ? n?.ToString() ?? request.EventType.ToString() : request.EventType.ToString();
        var isDwellUpdate = request.EventType == EventType.PageView
            && string.Equals(TryMetaString(request.Metadata, "dwellUpdate"), "true", StringComparison.OrdinalIgnoreCase);

        if (isDwellUpdate)
        {
            var timeOnPage = TryDouble(request.Metadata, "timeOnPage");
            var existing = await db.PageViews
                .Where(p => p.SessionId == session.SessionId && p.PageUrl == request.PageUrl)
                .OrderByDescending(p => p.Timestamp)
                .FirstOrDefaultAsync(cancellationToken);
            if (existing is not null && timeOnPage > existing.TimeOnPage)
                existing.TimeOnPage = timeOnPage;
            await db.SaveChangesAsync(cancellationToken);
            return new EventCollectionResult(Guid.Empty, session.SessionId, visitor.VisitorId);
        }

        var evt = new TrafficEvent
        {
            SiteId = siteId,
            SessionId = session.SessionId,
            VisitorId = visitor.VisitorId,
            EventType = request.EventType,
            EventName = eventName,
            PageUrl = request.PageUrl,
            Metadata = safeMetadata,
            Timestamp = now
        };
        await db.AddAsync(evt, cancellationToken);

        if (request.EventType == EventType.PageView)
        {
            await db.AddAsync(new PageView
            {
                SiteId = siteId,
                SessionId = session.SessionId,
                PageUrl = request.PageUrl,
                TimeOnPage = TryDouble(request.Metadata, "timeOnPage"),
                Timestamp = now
            }, cancellationToken);
        }

        // Only successful purchases (and explicit signups) become Conversion rows.
        // Buy/checkout clicks are engagement events — not conversions.
        if (request.EventType == EventType.Conversion)
        {
            var convType = TryParseConversionType(request.Metadata);
            if (convType is ConversionType.Purchase or ConversionType.Signup)
            {
                var shouldRecord = true;
                if (convType == ConversionType.Purchase)
                {
                    // Dedupe ONLY exact duplicate fires for the SAME visitor
                    // (double thank-you, double track). Never suppress another account's purchase.
                    var orderId = TryMetaString(request.Metadata, "orderId");
                    var purchaseNonce = TryMetaString(request.Metadata, "purchaseNonce");
                    var dedupeKey = !string.IsNullOrWhiteSpace(orderId)
                        ? orderId.Trim()
                        : purchaseNonce?.Trim();

                    if (!string.IsNullOrWhiteSpace(dedupeKey))
                    {
                        var recentMeta = await db.Events
                            .AsNoTracking()
                            .Where(e =>
                                e.SiteId == siteId
                                && e.VisitorId == visitor.VisitorId
                                && e.EventName == "order_completed"
                                && e.EventId != evt.EventId)
                            .OrderByDescending(e => e.Timestamp)
                            .Take(40)
                            .Select(e => e.Metadata)
                            .ToListAsync(cancellationToken);
                        shouldRecord = !recentMeta.Any(m =>
                            !string.IsNullOrEmpty(m) &&
                            m.Contains(dedupeKey, StringComparison.Ordinal));
                    }
                    else
                    {
                        // No orderId/nonce: only collapse rapid double-fires (same visitor, <20s).
                        // Do NOT block the whole session — that hid other buyers' conversions.
                        var windowStart = now.AddSeconds(-20);
                        shouldRecord = !await db.Conversions
                            .AsNoTracking()
                            .AnyAsync(c =>
                                c.SiteId == siteId
                                && c.SessionId == session.SessionId
                                && c.Type == ConversionType.Purchase
                                && c.Timestamp >= windowStart, cancellationToken);
                    }
                }

                if (shouldRecord)
                {
                    await db.AddAsync(new Conversion
                    {
                        SiteId = siteId,
                        SessionId = session.SessionId,
                        Type = convType.Value,
                        Value = TryDecimal(request.Metadata, "value"),
                        Timestamp = now
                    }, cancellationToken);
                }
            }
        }

        if (request.EventType is EventType.Click or EventType.Scroll)
        {
            await db.AddAsync(new HeatmapData
            {
                SiteId = siteId,
                PageUrl = request.PageUrl,
                X = (int)TryDouble(request.Metadata, "x"),
                Y = (int)TryDouble(request.Metadata, "y"),
                ScrollDepth = (int)TryDouble(request.Metadata, "scrollDepth"),
                DeviceType = detectedDevice,
                Timestamp = now
            }, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return new EventCollectionResult(evt.EventId, session.SessionId, visitor.VisitorId);
    }

    /// <summary>
    /// Prefer logged-in account id, then browser clientId, then IP+UA fingerprint.
    /// Different accounts on the same device therefore become different visitors.
    /// </summary>
    private static string ResolveVisitorKey(CollectEventRequest request, string ipAddress, string userAgent)
    {
        var userId = TryMetaString(request.Metadata, "userId")
            ?? TryMetaString(request.Metadata, "UserId");
        if (!string.IsNullOrWhiteSpace(userId))
            return "u:" + TruncateId(userId.Trim(), 90);

        var clientId = TryMetaString(request.Metadata, "clientId")
            ?? TryMetaString(request.Metadata, "ClientId")
            ?? TryMetaString(request.Metadata, "anonymousId");
        if (!string.IsNullOrWhiteSpace(clientId))
            return "c:" + TruncateId(clientId.Trim(), 90);

        return "d:" + BuildAnonymousId(ipAddress, userAgent);
    }

    private static string TruncateId(string value, int maxLen) =>
        value.Length <= maxLen ? value : value[..maxLen];

    private static string? TryMetaString(Dictionary<string, object?>? metadata, string key)
    {
        if (metadata is null) return null;
        if (!metadata.TryGetValue(key, out var v) || v is null) return null;

        // ASP.NET JSON often deserializes dictionary values as JsonElement.
        if (v is JsonElement je)
        {
            return je.ValueKind switch
            {
                JsonValueKind.String => NullIfEmpty(je.GetString()),
                JsonValueKind.Number => NullIfEmpty(je.ToString()),
                JsonValueKind.True => "true",
                JsonValueKind.False => "false",
                _ => NullIfEmpty(je.ToString())
            };
        }

        return NullIfEmpty(v.ToString()?.Trim());
    }

    private static string? NullIfEmpty(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    private static string? TryMetadataCountryCode(Dictionary<string, object?>? metadata)
    {
        if (metadata is null) return null;
        if (metadata.TryGetValue("countryCode", out var a) && a?.ToString() is { Length: >= 2 } c1)
            return c1[..2];
        if (metadata.TryGetValue("country", out var b) && b?.ToString() is { Length: >= 2 } c2)
            return c2[..2];
        return null;
    }

    private static string BuildAnonymousId(string ipAddress, string userAgent) => $"{ipAddress}:{userAgent}".GetHashCode().ToString("X");

    /// <summary>
    /// Classify Desktop / Mobile / Tablet from User-Agent, with optional metadata override
    /// (deviceType / device) for proxies or test harnesses that strip the real UA.
    /// </summary>
    private static DeviceType DetectDevice(string userAgent, Dictionary<string, object?>? metadata = null)
    {
        var hint = TryMetaString(metadata, "deviceType") ?? TryMetaString(metadata, "device");
        if (!string.IsNullOrWhiteSpace(hint))
        {
            var h = hint.Trim().ToLowerInvariant();
            if (h is "mobile" or "phone" or "smartphone") return DeviceType.Mobile;
            if (h is "tablet" or "ipad") return DeviceType.Tablet;
            if (h is "desktop" or "pc" or "computer") return DeviceType.Desktop;
        }

        if (string.IsNullOrWhiteSpace(userAgent)) return DeviceType.Unknown;
        var s = userAgent.ToLowerInvariant();

        // Tablets before phones: Android tablets usually omit "Mobile"; iPad may include it.
        if (s.Contains("ipad") || s.Contains("tablet") || s.Contains("kindle")
            || (s.Contains("android") && !s.Contains("mobile")))
            return DeviceType.Tablet;

        if (s.Contains("mobi") || s.Contains("iphone") || s.Contains("ipod")
            || s.Contains("android") || s.Contains("windows phone") || s.Contains("blackberry")
            || s.Contains("opera mini") || s.Contains("opera mobi"))
            return DeviceType.Mobile;

        return DeviceType.Desktop;
    }

    private readonly record struct SourceAttr(string Source, string Medium);

    /// <summary>
    /// Prefer UTM → page/document referrer → HTTP Referer header → (empty = unattributed).
    /// </summary>
    private static SourceAttr ResolveSource(Dictionary<string, object?>? metadata, string? headerReferrer)
    {
        var utmSource = TryMetaString(metadata, "utm_source") ?? TryMetaString(metadata, "source");
        if (!string.IsNullOrWhiteSpace(utmSource))
        {
            var medium = TryMetaString(metadata, "utm_medium") ?? "campaign";
            return new SourceAttr(TrafficAttribution.PrettySourceLabel(utmSource), medium);
        }

        var refUrl = ResolveReferrerUrl(metadata, headerReferrer);
        var host = TrafficAttribution.HostFromUrl(refUrl);
        if (!string.IsNullOrWhiteSpace(host))
            return new SourceAttr(TrafficAttribution.PrettySourceLabel(host), "referral");

        return new SourceAttr(string.Empty, "none");
    }

    private static string ResolveReferrerUrl(Dictionary<string, object?>? metadata, string? headerReferrer)
    {
        var fromMeta = TryMetaString(metadata, "referrer") ?? TryMetaString(metadata, "documentReferrer");
        if (!string.IsNullOrWhiteSpace(fromMeta)) return fromMeta.Trim();
        return headerReferrer?.Trim() ?? string.Empty;
    }

    private static string ExtractCampaign(Dictionary<string, object?>? metadata, string? pageUrl = null)
    {
        var camp = TryMetaString(metadata, "utm_campaign")
            ?? TryMetaString(metadata, "campaign")
            ?? TryMetaString(metadata, "Campaign");
        if (!string.IsNullOrWhiteSpace(camp)) return camp.Trim();
        return TrafficAttribution.CampaignFromPageUrl(pageUrl) ?? string.Empty;
    }

    private static double TryDouble(Dictionary<string, object?>? metadata, string key) =>
        metadata?.TryGetValue(key, out var v) == true && double.TryParse(v?.ToString(), out var result) ? result : 0;
    private static decimal? TryDecimal(Dictionary<string, object?>? metadata, string key) =>
        metadata?.TryGetValue(key, out var v) == true && decimal.TryParse(v?.ToString(), out var result) ? result : null;
    private static ConversionType? TryParseConversionType(Dictionary<string, object?>? metadata)
    {
        var value = metadata?.TryGetValue("type", out var t) == true ? t?.ToString() : null;
        if (Enum.TryParse<ConversionType>(value, true, out var parsed)
            && parsed is ConversionType.Purchase or ConversionType.Signup)
            return parsed;

        var eventName = metadata?.TryGetValue("eventName", out var n) == true ? n?.ToString() : null;
        return eventName?.Trim().ToLowerInvariant() switch
        {
            "order_completed" or "purchase" or "order_placed" or "sale" or "payment_completed" => ConversionType.Purchase,
            "signup" or "sign_up" or "lead" or "register" or "subscribe" => ConversionType.Signup,
            _ => null,
        };
    }
}

public sealed class AnalyticsService(ITrafficDbContext db) : IAnalyticsService
{
    public async Task<TrafficOverviewResponse> GetOverviewAsync(Guid siteId, int days, int timezoneOffsetMinutes = 0, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var sessions = db.Sessions.Where(x => x.SiteId == siteId && x.StartedAt >= since);

        var visitors = await db.Visitors.CountAsync(x => x.SiteId == siteId && x.LastSeenAt >= since, cancellationToken);
        var sessionsCount = await sessions.CountAsync(cancellationToken);
        // Dashboard "Conversions" = successful purchases only (not buy/checkout clicks).
        var conversionsCount = await db.Conversions.CountAsync(
            x => x.SiteId == siteId && x.Timestamp >= since && x.Type == ConversionType.Purchase,
            cancellationToken);

        // 0–1: share of sessions with meaningful interaction (first-party scroll/click, depth, multi-page, dwell, or conversion).
        double engagementRate = 0;
        if (sessionsCount > 0)
        {
            var engagedIds = await db.Events
                .AsNoTracking()
                .Where(x => x.SiteId == siteId && x.Timestamp >= since
                            && (x.EventType == EventType.Click || x.EventType == EventType.Scroll))
                .Select(x => x.SessionId)
                .Distinct()
                .ToListAsync(cancellationToken);

            var engaged = engagedIds.ToHashSet();

            var pageAgg = await db.PageViews
                .AsNoTracking()
                .Where(x => x.SiteId == siteId && x.Timestamp >= since)
                .GroupBy(x => x.SessionId)
                .Select(g => new { Sid = g.Key, Cnt = g.Count(), MaxDwell = g.Max(p => p.TimeOnPage) })
                .ToListAsync(cancellationToken);
            foreach (var row in pageAgg)
            {
                if (row.Cnt >= 2 || row.MaxDwell >= 10) engaged.Add(row.Sid);
            }

            var conversionSessions = await db.Conversions
                .AsNoTracking()
                .Where(x => x.SiteId == siteId && x.Timestamp >= since)
                .Select(x => x.SessionId)
                .Distinct()
                .ToListAsync(cancellationToken);
            foreach (var sid in conversionSessions) engaged.Add(sid);

            engagementRate = (double)engaged.Count / sessionsCount;
        }

        var visitorTrend = new Dictionary<DateTime, int>();
        var sessionTrend = new Dictionary<DateTime, int>();
        var pageViewTrend = new Dictionary<DateTime, int>();
        var conversionTrend = new Dictionary<DateTime, int>();
        var periods = new List<DateTime>();
        var now = DateTime.UtcNow;

        if (days == 1)
        {
            // Hourly trend over the last 24 hours in local time
            var localNow = now.AddMinutes(timezoneOffsetMinutes);
            for (int i = 23; i >= 0; i--)
            {
                var dt = localNow.AddHours(-i);
                periods.Add(new DateTime(dt.Year, dt.Month, dt.Day, dt.Hour, 0, 0, DateTimeKind.Utc));
            }

            var visitorHours = await db.Visitors
                .Where(x => x.SiteId == siteId && x.LastSeenAt >= since)
                .Select(x => new { LocalTime = x.LastSeenAt.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => new { x.LocalTime.Date, x.LocalTime.Hour })
                .Select(g => new { Date = g.Key.Date, Hour = g.Key.Hour, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in visitorHours)
                visitorTrend[new DateTime(x.Date.Year, x.Date.Month, x.Date.Day, x.Hour, 0, 0, DateTimeKind.Utc)] = x.Count;

            var sessionHours = await db.Sessions
                .Where(x => x.SiteId == siteId && x.StartedAt >= since)
                .Select(x => new { LocalTime = x.StartedAt.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => new { x.LocalTime.Date, x.LocalTime.Hour })
                .Select(g => new { Date = g.Key.Date, Hour = g.Key.Hour, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in sessionHours)
                sessionTrend[new DateTime(x.Date.Year, x.Date.Month, x.Date.Day, x.Hour, 0, 0, DateTimeKind.Utc)] = x.Count;

            var pageViewHours = await db.PageViews
                .Where(x => x.SiteId == siteId && x.Timestamp >= since)
                .Select(x => new { LocalTime = x.Timestamp.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => new { x.LocalTime.Date, x.LocalTime.Hour })
                .Select(g => new { Date = g.Key.Date, Hour = g.Key.Hour, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in pageViewHours)
                pageViewTrend[new DateTime(x.Date.Year, x.Date.Month, x.Date.Day, x.Hour, 0, 0, DateTimeKind.Utc)] = x.Count;

            var conversionHours = await db.Conversions
                .Where(x => x.SiteId == siteId && x.Timestamp >= since && x.Type == ConversionType.Purchase)
                .Select(x => new { LocalTime = x.Timestamp.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => new { x.LocalTime.Date, x.LocalTime.Hour })
                .Select(g => new { Date = g.Key.Date, Hour = g.Key.Hour, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in conversionHours)
                conversionTrend[new DateTime(x.Date.Year, x.Date.Month, x.Date.Day, x.Hour, 0, 0, DateTimeKind.Utc)] = x.Count;
        }
        else
        {
            // Daily trend in local time
            var localNow = now.AddMinutes(timezoneOffsetMinutes);
            for (int i = days - 1; i >= 0; i--)
            {
                periods.Add(localNow.Date.AddDays(-i));
            }

            var visitorDays = await db.Visitors
                .Where(x => x.SiteId == siteId && x.LastSeenAt >= since)
                .Select(x => new { LocalTime = x.LastSeenAt.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => x.LocalTime.Date)
                .Select(g => new { Day = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in visitorDays)
                visitorTrend[x.Day] = x.Count;

            var sessionDays = await db.Sessions
                .Where(x => x.SiteId == siteId && x.StartedAt >= since)
                .Select(x => new { LocalTime = x.StartedAt.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => x.LocalTime.Date)
                .Select(g => new { Day = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in sessionDays)
                sessionTrend[x.Day] = x.Count;

            var pageViewDays = await db.PageViews
                .Where(x => x.SiteId == siteId && x.Timestamp >= since)
                .Select(x => new { LocalTime = x.Timestamp.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => x.LocalTime.Date)
                .Select(g => new { Day = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in pageViewDays)
                pageViewTrend[x.Day] = x.Count;

            var conversionDays = await db.Conversions
                .Where(x => x.SiteId == siteId && x.Timestamp >= since && x.Type == ConversionType.Purchase)
                .Select(x => new { LocalTime = x.Timestamp.AddMinutes(timezoneOffsetMinutes) })
                .GroupBy(x => x.LocalTime.Date)
                .Select(g => new { Day = g.Key, Count = g.Count() })
                .ToListAsync(cancellationToken);
            foreach (var x in conversionDays)
                conversionTrend[x.Day] = x.Count;
        }

        var trend = periods
            .Select(p => new TrendPoint(
                days == 1 ? p.ToString("HH:00") : p.ToString("yyyy-MM-dd"),
                visitorTrend.GetValueOrDefault(p),
                sessionTrend.GetValueOrDefault(p),
                pageViewTrend.GetValueOrDefault(p),
                conversionTrend.GetValueOrDefault(p)))
            .ToList();

        return new TrafficOverviewResponse(visitors, sessionsCount, Math.Round(engagementRate, 4), conversionsCount, trend);
    }

    public async Task<IReadOnlyList<SourcePoint>> GetSourcesAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var rows = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .Select(x => new { x.Source, x.Referrer })
            .ToListAsync(cancellationToken);

        // Re-derive display labels from Source or Referrer; omit unattributed "direct".
        var groups = rows
            .Select(x => TrafficAttribution.PreferDisplaySource(x.Source, x.Referrer))
            .Where(s => !string.IsNullOrWhiteSpace(s))
            .GroupBy(s => s, StringComparer.OrdinalIgnoreCase)
            .Select(g => new { Source = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .ToList();

        var total = groups.Sum(x => x.Count);
        if (total == 0) return [];
        return groups
            .Select(x => new SourcePoint(x.Source, x.Count, Math.Round((double)x.Count * 100 / total, 2)))
            .ToList();
    }

    public async Task<IReadOnlyList<PagePoint>> GetPagesAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        // Load pageviews in one pass to compute views, avg time, and bounce/session metrics.
        var pageViews = await db.PageViews
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Timestamp >= since)
            .ToListAsync(cancellationToken);

        var conversionRows = await db.Events
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Timestamp >= since && x.EventType == EventType.Conversion)
            .Select(x => x.PageUrl)
            .ToListAsync(cancellationToken);
        var conversionsByPage = conversionRows
            .Where(p => !string.IsNullOrWhiteSpace(p))
            .GroupBy(p => p, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

        var pageViewCountBySession = pageViews
            .GroupBy(p => p.SessionId)
            .ToDictionary(g => g.Key, g => g.Count());

        var rows = pageViews
            .Where(p => !string.IsNullOrWhiteSpace(p.PageUrl))
            .GroupBy(p => p.PageUrl, StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var distinctSessions = g.Select(x => x.SessionId).Distinct().ToList();
                var enteredSessions = distinctSessions.Count;
                var bouncedSessions = distinctSessions.Count(sid => pageViewCountBySession.GetValueOrDefault(sid) <= 1);
                var bounceRate = enteredSessions == 0 ? 0 : (double)bouncedSessions * 100.0 / enteredSessions;
                return new
                {
                    PageUrl = g.Key,
                    Views = g.Count(),
                    AvgSeconds = g.Average(x => x.TimeOnPage),
                    BounceRate = bounceRate,
                    Conversions = conversionsByPage.GetValueOrDefault(g.Key, 0),
                };
            })
            .OrderByDescending(x => x.Views)
            .ToList();

        return rows
            .Select(x => new PagePoint(
                x.PageUrl,
                x.Views,
                Math.Round(x.AvgSeconds, 2),
                Math.Round(x.BounceRate, 1),
                x.Conversions))
            .ToList();
    }

    public async Task<IReadOnlyList<ConversionPoint>> GetConversionsAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var rows = await db.Conversions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Timestamp >= since)
            .GroupBy(x => x.Type)
            .Select(g => new { Type = g.Key, Count = g.Count(), ValueSum = g.Sum(x => x.Value) })
            .OrderByDescending(x => x.Count)
            .ToListAsync(cancellationToken);
        return rows
            .Select(x => new ConversionPoint(x.Type.ToString(), x.Count, x.ValueSum))
            .ToList();
    }

    public async Task<IReadOnlyList<DevicePoint>> GetDevicesAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var rows = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .GroupBy(x => x.DeviceType)
            .Select(g => new { Device = g.Key, SessionCount = g.Count() })
            .OrderByDescending(x => x.SessionCount)
            .ToListAsync(cancellationToken);
        return rows
            .Select(x => new DevicePoint(x.Device.ToString(), x.SessionCount))
            .ToList();
    }

    public async Task<IReadOnlyList<CountryPoint>> GetCountriesAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var groups = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .GroupBy(x => x.Country)
            .Select(g => new { Country = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var total = groups.Sum(x => x.Count);
        if (total == 0) return [];
        return groups
            .OrderByDescending(x => x.Count)
            .Select(x => new CountryPoint(
                string.IsNullOrWhiteSpace(x.Country) ? "Unknown" : x.Country,
                x.Count,
                Math.Round((double)x.Count * 100 / total, 2)))
            .ToList();
    }

    public async Task<IReadOnlyList<ReferrerPoint>> GetReferrersAsync(Guid siteId, int days, int take = 20, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var sessions = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .Select(x => new { x.SessionId, x.Referrer, x.Source })
            .ToListAsync(cancellationToken);

        if (sessions.Count == 0) return [];

        var engagedSessionIds = await db.Events
            .AsNoTracking()
            .Where(e => e.SiteId == siteId && e.Timestamp >= since
                        && (e.EventType == EventType.Click || e.EventType == EventType.Scroll))
            .Select(e => e.SessionId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var engaged = engagedSessionIds.ToHashSet();

        // Multi-page sessions also count as engaged.
        var multiPage = await db.PageViews
            .AsNoTracking()
            .Where(p => p.SiteId == siteId && p.Timestamp >= since)
            .GroupBy(p => p.SessionId)
            .Where(g => g.Count() >= 2)
            .Select(g => g.Key)
            .ToListAsync(cancellationToken);
        foreach (var sid in multiPage) engaged.Add(sid);

        var convertedSessionIds = await db.Conversions
            .AsNoTracking()
            .Where(c => c.SiteId == siteId && c.Timestamp >= since && c.Type == ConversionType.Purchase)
            .Select(c => c.SessionId)
            .Distinct()
            .ToListAsync(cancellationToken);
        var converted = convertedSessionIds.ToHashSet();

        var grouped = sessions
            .Select(x => new
            {
                Label = TrafficAttribution.PreferDisplaySource(x.Source, x.Referrer),
                x.SessionId,
            })
            .Where(x => !string.IsNullOrWhiteSpace(x.Label))
            .GroupBy(x => x.Label, StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var visits = g.Count();
                var eng = g.Count(s => engaged.Contains(s.SessionId));
                var conv = g.Count(s => converted.Contains(s.SessionId));
                return new ReferrerPoint(
                    g.Key,
                    visits,
                    visits == 0 ? 0 : Math.Round((double)eng * 100 / visits, 1),
                    visits == 0 ? 0 : Math.Round((double)conv * 100 / visits, 1));
            })
            .OrderByDescending(x => x.Visits)
            .Take(take)
            .ToList();

        return grouped;
    }

    public async Task<IReadOnlyList<CampaignPoint>> GetCampaignsAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var allSessions = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .Select(x => new { x.SessionId, x.Campaign })
            .ToListAsync(cancellationToken);

        // Campaigns from ?campaign= / ?utm_campaign= page URLs (e.g. /catalog?campaign=Flash%20Friday).
        // A session that hits multiple campaign links can contribute to each campaign row.
        var pageUrls = await db.PageViews
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Timestamp >= since
                        && (x.PageUrl.Contains("campaign=") || x.PageUrl.Contains("utm_campaign=")))
            .Select(x => new { x.SessionId, x.PageUrl, x.Timestamp })
            .ToListAsync(cancellationToken);

        // campaign name -> set of session ids
        var sessionsByCampaign = new Dictionary<string, HashSet<Guid>>(StringComparer.OrdinalIgnoreCase);

        void AddSession(string? name, Guid sessionId)
        {
            if (string.IsNullOrWhiteSpace(name) || sessionId == Guid.Empty) return;
            var key = name.Trim();
            if (!sessionsByCampaign.TryGetValue(key, out var set))
            {
                set = [];
                sessionsByCampaign[key] = set;
            }
            set.Add(sessionId);
        }

        foreach (var s in allSessions)
            AddSession(s.Campaign, s.SessionId);

        foreach (var pv in pageUrls)
            AddSession(TrafficAttribution.CampaignFromPageUrl(pv.PageUrl), pv.SessionId);

        // Primary campaign per session (for conversion attribution + organic bucket):
        // prefer stored Session.Campaign, else first campaign seen on a page URL.
        var primaryCampaignBySession = new Dictionary<Guid, string>();
        foreach (var s in allSessions)
        {
            if (!string.IsNullOrWhiteSpace(s.Campaign))
                primaryCampaignBySession[s.SessionId] = s.Campaign.Trim();
        }
        foreach (var pv in pageUrls.OrderBy(x => x.Timestamp))
        {
            if (primaryCampaignBySession.ContainsKey(pv.SessionId)) continue;
            var fromUrl = TrafficAttribution.CampaignFromPageUrl(pv.PageUrl);
            if (!string.IsNullOrWhiteSpace(fromUrl))
                primaryCampaignBySession[pv.SessionId] = fromUrl;
        }

        var conversionSessions = await db.Conversions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Timestamp >= since && x.Type == ConversionType.Purchase)
            .Select(x => x.SessionId)
            .ToListAsync(cancellationToken);

        var conversionByCampaign = conversionSessions
            .Select(sid => primaryCampaignBySession.TryGetValue(sid, out var campaign) ? campaign : null)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .GroupBy(c => c!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.Count(), StringComparer.OrdinalIgnoreCase);

        var rows = sessionsByCampaign
            .Select(kv => (
                Name: kv.Key,
                Visits: kv.Value.Count,
                Conversions: conversionByCampaign.GetValueOrDefault(kv.Key, 0)))
            .OrderByDescending(x => x.Visits)
            .ToList();

        var attributedSessionIds = primaryCampaignBySession.Keys.ToHashSet();
        // Also treat any session that hit a campaign URL as attributed (even if multi-touch).
        foreach (var set in sessionsByCampaign.Values)
            attributedSessionIds.UnionWith(set);

        var organicSessions = allSessions
            .Where(s => !attributedSessionIds.Contains(s.SessionId))
            .Select(s => s.SessionId)
            .ToList();

        if (organicSessions.Count > 0)
        {
            var organicSet = organicSessions.ToHashSet();
            var organicConv = conversionSessions.Count(sid => organicSet.Contains(sid));
            rows.Add(("Organic / Direct", organicSessions.Count, organicConv));
        }

        return rows
            .OrderByDescending(x => x.Visits)
            .Select(x => new CampaignPoint(x.Name, x.Visits, x.Conversions))
            .ToList();
    }
}

public sealed class FunnelService(ITrafficDbContext db) : IFunnelService
{
    public async Task<IReadOnlyList<FunnelStepDto>> CalculateAsync(Guid siteId, IReadOnlyList<string> steps, int days, CancellationToken cancellationToken = default)
    {
        var raw = steps.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()).ToList();
        if (raw.Count == 0) return [];

        var funnelSteps = new List<string>();
        foreach (var s in raw)
        {
            if (funnelSteps.Count == 0 ||
                !string.Equals(funnelSteps[^1], s, StringComparison.OrdinalIgnoreCase))
                funnelSteps.Add(s);
        }

        if (funnelSteps.Count == 0) return [];

        var since = DateTime.UtcNow.AddDays(-days);
        // Pull ALL events (not just page views) so a funnel step can be either a page URL/path
        // (e.g. "/checkout") OR a business event name (e.g. "add_to_cart", "order_completed").
        var hits = await db.Events
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Timestamp >= since)
            .OrderBy(x => x.SessionId)
            .ThenBy(x => x.Timestamp)
            .Select(x => new { x.SessionId, x.EventName, x.PageUrl })
            .ToListAsync(cancellationToken);

        var chains = hits
            .GroupBy(x => x.SessionId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(x => new FunnelToken(x.EventName ?? string.Empty, x.PageUrl ?? string.Empty)).ToList());

        var universe = chains.Keys.ToHashSet();
        if (universe.Count == 0)
        {
            return funnelSteps
                .Select(st => new FunnelStepDto(st, 0, 0, 0, 0))
                .ToList();
        }

        var completedByStep = new int[funnelSteps.Count];
        for (var k = 0; k < funnelSteps.Count; k++)
        {
            var prefixLen = k + 1;
            var n = 0;
            foreach (var sid in universe)
            {
                if (!chains.TryGetValue(sid, out var urls)) continue;
                if (MatchesOrderedPrefix(urls, funnelSteps, prefixLen))
                    n++;
            }

            completedByStep[k] = n;
        }

        var totalSessions = universe.Count;
        var result = new List<FunnelStepDto>(funnelSteps.Count);
        for (var k = 0; k < funnelSteps.Count; k++)
        {
            var entered = k == 0 ? totalSessions : completedByStep[k - 1];
            var completed = completedByStep[k];
            var conversion = entered == 0 ? 0 : (double)completed / entered * 100;
            var drop = entered == 0 ? 0 : (entered - completed) * 100.0 / entered;
            result.Add(new FunnelStepDto(
                funnelSteps[k],
                entered,
                completed,
                Math.Round(conversion, 2),
                Math.Round(drop, 2)));
        }

        return result;
    }

    private readonly record struct FunnelToken(string EventName, string PageUrl);

    private static bool MatchesOrderedPrefix(IReadOnlyList<FunnelToken> tokens, IReadOnlyList<string> funnelSteps, int stepCount)
    {
        if (stepCount <= 0 || stepCount > funnelSteps.Count) return false;
        var u = 0;
        for (var s = 0; s < stepCount; s++)
        {
            while (u < tokens.Count && !TokenMatchesStep(tokens[u], funnelSteps[s]))
                u++;
            if (u >= tokens.Count) return false;
            u++;
        }

        return true;
    }

    // A step matches if it equals the event name (e.g. "add_to_cart") or the page URL/path.
    private static bool TokenMatchesStep(FunnelToken token, string step)
    {
        if (!string.IsNullOrEmpty(token.EventName) &&
            string.Equals(token.EventName, step, StringComparison.OrdinalIgnoreCase))
            return true;
        return UrlMatchesPage(token.PageUrl, step);
    }

    private static bool UrlMatchesPage(string pageUrl, string step)
    {
        if (string.IsNullOrEmpty(pageUrl) || string.IsNullOrEmpty(step)) return false;
        if (string.Equals(pageUrl, step, StringComparison.OrdinalIgnoreCase)) return true;
        if (pageUrl.Contains(step, StringComparison.OrdinalIgnoreCase)) return true;
        if (!Uri.TryCreate(pageUrl, UriKind.Absolute, out var uri)) return false;
        var path = uri.AbsolutePath;
        if (string.Equals(path, step, StringComparison.OrdinalIgnoreCase)) return true;
        return step.StartsWith('/') && path.Contains(step, StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class HeatmapService(ITrafficDbContext db) : IHeatmapService
{
    public async Task<IReadOnlyList<HeatmapPointDto>> GetPageHeatmapAsync(Guid siteId, string pageUrl, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var rows = await db.HeatmapData
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.PageUrl == pageUrl && x.Timestamp >= since)
            .GroupBy(x => new { x.X, x.Y })
            .Select(g => new { g.Key.X, g.Key.Y, Cnt = g.Count(), AvgScroll = g.Average(x => (double)x.ScrollDepth) })
            .OrderByDescending(x => x.Cnt)
            .ToListAsync(cancellationToken);
        return rows
            .Select(x => new HeatmapPointDto(x.X, x.Y, x.Cnt, (int)Math.Round(x.AvgScroll)))
            .ToList();
    }

    public async Task<IReadOnlyList<ScrollDepthPointDto>> GetScrollDepthAsync(
        Guid siteId,
        string pageUrl,
        int days,
        CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);

        var pageViews = await db.PageViews
            .AsNoTracking()
            .CountAsync(x => x.SiteId == siteId && x.PageUrl == pageUrl && x.Timestamp >= since, cancellationToken);

        // Tracker scroll milestones are stored as Heatmap rows at (0,0) with depth 25/50/75/100.
        var milestoneRows = await db.HeatmapData
            .AsNoTracking()
            .Where(x =>
                x.SiteId == siteId
                && x.PageUrl == pageUrl
                && x.Timestamp >= since
                && x.X == 0
                && x.Y == 0
                && (x.ScrollDepth == 25 || x.ScrollDepth == 50 || x.ScrollDepth == 75 || x.ScrollDepth == 100))
            .GroupBy(x => x.ScrollDepth)
            .Select(g => new { Depth = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        // Fallback: older/mixed data without clean (0,0) milestones — snap any scroll depths.
        if (milestoneRows.Count == 0)
        {
            var raw = await db.HeatmapData
                .AsNoTracking()
                .Where(x => x.SiteId == siteId && x.PageUrl == pageUrl && x.Timestamp >= since && x.ScrollDepth > 0)
                .Select(x => x.ScrollDepth)
                .ToListAsync(cancellationToken);

            milestoneRows = raw
                .Select(SnapScrollMilestone)
                .Where(d => d > 0)
                .GroupBy(d => d)
                .Select(g => new { Depth = g.Key, Count = g.Count() })
                .ToList();
        }

        var hits = new Dictionary<int, int> { [25] = 0, [50] = 0, [75] = 0, [100] = 0 };
        foreach (var row in milestoneRows)
        {
            if (hits.ContainsKey(row.Depth))
                hits[row.Depth] = row.Count;
        }

        var baseline = pageViews > 0
            ? pageViews
            : Math.Max(1, hits.Values.DefaultIfEmpty(0).Max());

        static double Pct(int reached, int baseCount) =>
            Math.Round(100.0 * reached / Math.Max(1, baseCount), 1);

        return
        [
            new ScrollDepthPointDto(
                0,
                baseline,
                100,
                "Top of page",
                "Everyone who opened this page starts here."),
            new ScrollDepthPointDto(
                25,
                hits[25],
                Pct(hits[25], baseline),
                "About 25% down",
                "Visitors who scrolled past the first section of the page."),
            new ScrollDepthPointDto(
                50,
                hits[50],
                Pct(hits[50], baseline),
                "Halfway",
                "Visitors who made it to the middle of the page."),
            new ScrollDepthPointDto(
                75,
                hits[75],
                Pct(hits[75], baseline),
                "About 75% down",
                "Visitors who kept scrolling into the lower content."),
            new ScrollDepthPointDto(
                100,
                hits[100],
                Pct(hits[100], baseline),
                "Bottom of page",
                "Visitors who scrolled all the way to the end."),
        ];
    }

    private static int SnapScrollMilestone(int depth) => depth switch
    {
        <= 12 => 0,
        <= 37 => 25,
        <= 62 => 50,
        <= 87 => 75,
        _ => 100
    };
}

public sealed class SnapshotService(ITrafficDbContext db) : ISnapshotService
{
    public async Task CreateDailySnapshotsAsync(DateOnly day, CancellationToken cancellationToken = default)
    {
        var start = day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        var end = start.AddDays(1);
        var siteIds = await db.Sites.Select(x => x.SiteId).ToListAsync(cancellationToken);

        foreach (var siteId in siteIds)
        {
            var exists = await db.DailySnapshots.AnyAsync(x => x.SiteId == siteId && x.Date == day, cancellationToken);
            if (exists) continue;

            var source = await db.Sessions.Where(x => x.SiteId == siteId && x.StartedAt >= start && x.StartedAt < end)
                .GroupBy(x => x.Source).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

            var topPage = await db.PageViews.Where(x => x.SiteId == siteId && x.Timestamp >= start && x.Timestamp < end)
                .GroupBy(x => x.PageUrl).OrderByDescending(g => g.Count()).Select(g => g.Key).FirstOrDefaultAsync(cancellationToken) ?? string.Empty;

            await db.AddAsync(new DailySnapshot
            {
                SiteId = siteId,
                Date = day,
                TotalVisitors = await db.Visitors.CountAsync(x => x.SiteId == siteId && x.LastSeenAt >= start && x.LastSeenAt < end, cancellationToken),
                Sessions = await db.Sessions.CountAsync(x => x.SiteId == siteId && x.StartedAt >= start && x.StartedAt < end, cancellationToken),
                PageViews = await db.PageViews.CountAsync(x => x.SiteId == siteId && x.Timestamp >= start && x.Timestamp < end, cancellationToken),
                Conversions = await db.Conversions.CountAsync(x => x.SiteId == siteId && x.Timestamp >= start && x.Timestamp < end, cancellationToken),
                TopSource = source,
                TopPage = topPage,
                CreatedAt = DateTime.UtcNow
            }, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class SessionMaintenanceService(ITrafficDbContext db) : ISessionMaintenanceService
{
    public async Task FinalizeInactiveSessionsAsync(TimeSpan timeout, CancellationToken cancellationToken = default)
    {
        var threshold = DateTime.UtcNow.Subtract(timeout);
        var openSessions = await db.Sessions.Where(x => x.EndedAt == null && x.LastActivityAt < threshold).ToListAsync(cancellationToken);
        foreach (var session in openSessions) session.EndedAt = session.LastActivityAt.AddMinutes(1);
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DataCleanupService(ITrafficDbContext db) : IDataCleanupService
{
    public async Task CleanupOldRawEventsAsync(int olderThanDays, CancellationToken cancellationToken = default)
    {
        var threshold = DateTime.UtcNow.AddDays(-olderThanDays);
        var oldEvents = await db.Events.Where(x => x.Timestamp < threshold).Take(5000).ToListAsync(cancellationToken);
        if (oldEvents.Count == 0) return;

        // Keep aggregated data and only purge old raw events.
        foreach (var item in oldEvents)
        {
            if (db is TrafficDbContext ctx) ctx.EventsSet.Remove(item);
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? "Server=localhost;Port=3306;Database=sc_web_traffic;User=root;Password=;";

        services.AddDbContext<TrafficDbContext>(options =>
            options.UseMySql(connectionString, new MySqlServerVersion(new Version(8, 0, 36))));

        services.AddMemoryCache();
        services
            .AddHttpClient(nameof(IpCountryResolver), client =>
            {
                client.Timeout = TimeSpan.FromSeconds(2);
            });
        services.AddSingleton<IIpCountryResolver, IpCountryResolver>();

        services.AddScoped<ITrafficDbContext>(sp => sp.GetRequiredService<TrafficDbContext>());
        services.AddScoped<ISchemaInitializer, SchemaInitializer>();
        services.AddScoped<IEventCollectionService, EventCollectionService>();
        services.AddScoped<IAnalyticsService, AnalyticsService>();
        services.AddScoped<IFunnelService, FunnelService>();
        services.AddScoped<IHeatmapService, HeatmapService>();
        services.AddScoped<ISnapshotService, SnapshotService>();
        services.AddScoped<ISessionMaintenanceService, SessionMaintenanceService>();
        services.AddScoped<IDataCleanupService, DataCleanupService>();
        services.AddSingleton<ITokenService, TokenService>();
        return services;
    }
}
