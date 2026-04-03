using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using SCWebTraffic.Application;
using SCWebTraffic.Domain;
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

public sealed class EventCollectionService(ITrafficDbContext db) : IEventCollectionService
{
    public async Task<EventCollectionResult> CollectAsync(
        CollectEventRequest request,
        string ipAddress,
        string userAgent,
        string? referrer,
        CancellationToken cancellationToken = default)
    {
        var siteExists = await db.Sites.AnyAsync(x => x.SiteId == request.SiteId, cancellationToken);
        if (!siteExists) throw new InvalidOperationException("Invalid siteId.");

        var now = request.Timestamp?.ToUniversalTime() ?? DateTime.UtcNow;
        var anonId = BuildAnonymousId(ipAddress, userAgent);
        var visitor = await db.Visitors
            .OrderByDescending(x => x.LastSeenAt)
            .FirstOrDefaultAsync(x => x.SiteId == request.SiteId && x.AnonymousId == anonId, cancellationToken);

        if (visitor is null)
        {
            visitor = new Visitor
            {
                SiteId = request.SiteId,
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

        var session = await db.Sessions
            .OrderByDescending(x => x.LastActivityAt)
            .FirstOrDefaultAsync(x => x.SiteId == request.SiteId && x.VisitorId == visitor.VisitorId && x.EndedAt == null, cancellationToken);

        if (session is null || session.LastActivityAt < DateTime.UtcNow.AddMinutes(-30))
        {
            session = new Session
            {
                SiteId = request.SiteId,
                VisitorId = visitor.VisitorId,
                StartedAt = now,
                LastActivityAt = now,
                DeviceType = DetectDevice(userAgent),
                Country = "Unknown",
                Referrer = referrer ?? string.Empty,
                Source = InferSource(referrer),
                Medium = string.IsNullOrWhiteSpace(referrer) ? "none" : "referral",
                Campaign = ExtractCampaign(request.Metadata)
            };
            await db.AddAsync(session, cancellationToken);
        }
        else
        {
            session.LastActivityAt = now;
        }

        var safeMetadata = JsonSerializer.Serialize(request.Metadata ?? new Dictionary<string, object?>());
        var eventName = request.Metadata?.TryGetValue("eventName", out var n) == true ? n?.ToString() ?? request.EventType.ToString() : request.EventType.ToString();
        var evt = new TrafficEvent
        {
            SiteId = request.SiteId,
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
                SiteId = request.SiteId,
                SessionId = session.SessionId,
                PageUrl = request.PageUrl,
                TimeOnPage = TryDouble(request.Metadata, "timeOnPage"),
                Timestamp = now
            }, cancellationToken);
        }

        if (request.EventType == EventType.Conversion)
        {
            await db.AddAsync(new Conversion
            {
                SiteId = request.SiteId,
                SessionId = session.SessionId,
                Type = ParseConversionType(request.Metadata),
                Value = TryDecimal(request.Metadata, "value"),
                Timestamp = now
            }, cancellationToken);
        }

        if (request.EventType is EventType.Click or EventType.Scroll)
        {
            await db.AddAsync(new HeatmapData
            {
                SiteId = request.SiteId,
                PageUrl = request.PageUrl,
                X = (int)TryDouble(request.Metadata, "x"),
                Y = (int)TryDouble(request.Metadata, "y"),
                ScrollDepth = (int)TryDouble(request.Metadata, "scrollDepth"),
                DeviceType = DetectDevice(userAgent),
                Timestamp = now
            }, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
        return new EventCollectionResult(evt.EventId, session.SessionId, visitor.VisitorId);
    }

    private static string BuildAnonymousId(string ipAddress, string userAgent) => $"{ipAddress}:{userAgent}".GetHashCode().ToString("X");
    private static DeviceType DetectDevice(string userAgent) => userAgent.ToLowerInvariant() switch
    {
        var s when s.Contains("mobile") => DeviceType.Mobile,
        var s when s.Contains("tablet") || s.Contains("ipad") => DeviceType.Tablet,
        var s when string.IsNullOrWhiteSpace(s) => DeviceType.Unknown,
        _ => DeviceType.Desktop
    };
    private static string InferSource(string? referrer)
    {
        if (string.IsNullOrWhiteSpace(referrer)) return "direct";
        if (!Uri.TryCreate(referrer, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return "direct";
        return string.IsNullOrWhiteSpace(uri.Host) ? "direct" : uri.Host;
    }
    private static string ExtractCampaign(Dictionary<string, object?>? metadata) =>
        metadata?.TryGetValue("campaign", out var c) == true ? c?.ToString() ?? string.Empty : string.Empty;
    private static double TryDouble(Dictionary<string, object?>? metadata, string key) =>
        metadata?.TryGetValue(key, out var v) == true && double.TryParse(v?.ToString(), out var result) ? result : 0;
    private static decimal? TryDecimal(Dictionary<string, object?>? metadata, string key) =>
        metadata?.TryGetValue(key, out var v) == true && decimal.TryParse(v?.ToString(), out var result) ? result : null;
    private static ConversionType ParseConversionType(Dictionary<string, object?>? metadata)
    {
        var value = metadata?.TryGetValue("type", out var t) == true ? t?.ToString() : null;
        return Enum.TryParse<ConversionType>(value, true, out var parsed) ? parsed : ConversionType.Signup;
    }
}

public sealed class AnalyticsService(ITrafficDbContext db) : IAnalyticsService
{
    public async Task<TrafficOverviewResponse> GetOverviewAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var sessions = db.Sessions.Where(x => x.SiteId == siteId && x.StartedAt >= since);
        var events = db.Events.Where(x => x.SiteId == siteId && x.Timestamp >= since);

        var visitors = await db.Visitors.CountAsync(x => x.SiteId == siteId && x.LastSeenAt >= since, cancellationToken);
        var sessionsCount = await sessions.CountAsync(cancellationToken);
        var conversionsCount = await db.Conversions.CountAsync(x => x.SiteId == siteId && x.Timestamp >= since, cancellationToken);
        var engagementRate = sessionsCount == 0
            ? 0
            : (double)await events.CountAsync(x => x.EventType == EventType.Click || x.EventType == EventType.Scroll, cancellationToken) / sessionsCount;

        var visitorDays = await db.Visitors
            .Where(x => x.SiteId == siteId && x.LastSeenAt >= since)
            .GroupBy(x => x.LastSeenAt.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var sessionDays = await db.Sessions
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .GroupBy(x => x.StartedAt.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var pageViewDays = await db.PageViews
            .Where(x => x.SiteId == siteId && x.Timestamp >= since)
            .GroupBy(x => x.Timestamp.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var conversionDays = await db.Conversions
            .Where(x => x.SiteId == siteId && x.Timestamp >= since)
            .GroupBy(x => x.Timestamp.Date)
            .Select(g => new { Day = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);

        var allDays = visitorDays.Select(x => x.Day)
            .Union(sessionDays.Select(x => x.Day))
            .Union(pageViewDays.Select(x => x.Day))
            .Union(conversionDays.Select(x => x.Day))
            .Distinct()
            .OrderBy(d => d)
            .ToList();

        var vd = visitorDays.ToDictionary(x => x.Day, x => x.Count);
        var sd = sessionDays.ToDictionary(x => x.Day, x => x.Count);
        var pvd = pageViewDays.ToDictionary(x => x.Day, x => x.Count);
        var cd = conversionDays.ToDictionary(x => x.Day, x => x.Count);

        var trend = allDays
            .Select(d => new TrendPoint(
                d.ToString("yyyy-MM-dd"),
                vd.GetValueOrDefault(d),
                sd.GetValueOrDefault(d),
                pvd.GetValueOrDefault(d),
                cd.GetValueOrDefault(d)))
            .ToList();

        return new TrafficOverviewResponse(visitors, sessionsCount, Math.Round(engagementRate, 4), conversionsCount, trend);
    }

    public async Task<IReadOnlyList<SourcePoint>> GetSourcesAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        // Avoid translating (count * 100 / total) with a captured int — Pomelo/MySQL often throws at runtime.
        var groups = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .GroupBy(x => x.Source)
            .Select(g => new { Source = g.Key, Count = g.Count() })
            .ToListAsync(cancellationToken);
        var total = groups.Sum(x => x.Count);
        if (total == 0) return [];
        return groups
            .OrderByDescending(x => x.Count)
            .Select(x => new SourcePoint(
                string.IsNullOrWhiteSpace(x.Source) ? "direct" : x.Source,
                x.Count,
                Math.Round((double)x.Count * 100 / total, 2)))
            .ToList();
    }

    public async Task<IReadOnlyList<PagePoint>> GetPagesAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        // Project only DB-translatable shapes; Math.Round + record ctor often break Pomelo/MySQL.
        var rows = await db.PageViews
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.Timestamp >= since)
            .GroupBy(x => x.PageUrl)
            .Select(g => new { PageUrl = g.Key, Views = g.Count(), AvgSeconds = g.Average(x => x.TimeOnPage) })
            .OrderByDescending(x => x.Views)
            .ToListAsync(cancellationToken);
        return rows
            .Select(x => new PagePoint(x.PageUrl, x.Views, Math.Round(x.AvgSeconds, 2)))
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
        // Load referrer strings only, aggregate in memory — avoids Pomelo/MySQL edge cases on GROUP BY long VARCHAR.
        var referrerStrings = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since)
            .Select(x => x.Referrer)
            .ToListAsync(cancellationToken);
        var rows = referrerStrings
            .Where(r => !string.IsNullOrWhiteSpace(r))
            .GroupBy(r => r, StringComparer.Ordinal)
            .Select(g => (Referrer: g.Key, Visits: g.Count()))
            .OrderByDescending(x => x.Visits)
            .Take(take)
            .ToList();
        return rows.Select(x => new ReferrerPoint(x.Referrer, x.Visits)).ToList();
    }

    public async Task<IReadOnlyList<CampaignPoint>> GetCampaignsAsync(Guid siteId, int days, CancellationToken cancellationToken = default)
    {
        var since = DateTime.UtcNow.AddDays(-days);
        var rows = await db.Sessions
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && x.StartedAt >= since && !string.IsNullOrWhiteSpace(x.Campaign))
            .GroupBy(x => x.Campaign)
            .Select(g => new { Name = g.Key, Visits = g.Count() })
            .OrderByDescending(x => x.Visits)
            .ToListAsync(cancellationToken);
        return rows.Select(x => new CampaignPoint(x.Name, x.Visits, 0)).ToList();
    }
}

public sealed class FunnelService(ITrafficDbContext db) : IFunnelService
{
    public async Task<IReadOnlyList<FunnelStepDto>> CalculateAsync(Guid siteId, IReadOnlyList<string> steps, int days, CancellationToken cancellationToken = default)
    {
        if (steps.Count == 0) return [];
        var since = DateTime.UtcNow.AddDays(-days);
        var events = await db.Events.Where(x => x.SiteId == siteId && x.Timestamp >= since).ToListAsync(cancellationToken);
        var result = new List<FunnelStepDto>(steps.Count);

        var previousCompleted = events.Select(x => x.SessionId).Distinct().Count();
        foreach (var step in steps)
        {
            var entered = previousCompleted;
            var completedSessions = events
                .Where(x => x.EventName.Equals(step, StringComparison.OrdinalIgnoreCase) || x.PageUrl.Contains(step, StringComparison.OrdinalIgnoreCase))
                .Select(x => x.SessionId)
                .Distinct()
                .Count();
            var conversion = entered == 0 ? 0 : (double)completedSessions / entered * 100;
            var drop = 100 - conversion;
            result.Add(new FunnelStepDto(step, entered, completedSessions, Math.Round(conversion, 2), Math.Round(drop, 2)));
            previousCompleted = completedSessions;
        }

        return result;
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
