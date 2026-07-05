using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SCWebTraffic.Application;
using SCWebTraffic.Domain;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

namespace SCWebTraffic.API;

/// <summary>
/// JwtBearer maps JWT "sub" to ClaimTypes.NameIdentifier. Use both when resolving the user id.
/// </summary>
internal static class JwtUserId
{
    public static string? FromPrincipal(ClaimsPrincipal user) =>
        user.FindFirst(ClaimTypes.NameIdentifier)?.Value
        ?? user.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
}

internal static class SiteUrlNormalizer
{
    public static bool TryNormalize(string? input, out string domain, out string? error)
    {
        error = null;
        domain = "";
        input = input?.Trim() ?? "";
        if (string.IsNullOrEmpty(input))
        {
            error = "URL is required.";
            return false;
        }

        if (!Uri.TryCreate(input, UriKind.Absolute, out var uri))
        {
            if (!Uri.TryCreate("https://" + input, UriKind.Absolute, out uri))
            {
                error = "Invalid URL.";
                return false;
            }
        }

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
        {
            error = "URL must start with http or https.";
            return false;
        }

        domain = uri.Host.ToLowerInvariant();
        if (domain.StartsWith("www.", StringComparison.Ordinal))
            domain = domain[4..];

        if (string.IsNullOrEmpty(domain))
        {
            error = "Could not read a host name from the URL.";
            return false;
        }

        return true;
    }
}

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(ITrafficDbContext db, ITokenService tokenService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResultDto>> Login([FromBody] AuthRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        var user = await db.AppUsers.FirstOrDefaultAsync(x => x.Email == email, cancellationToken);
        if (user is null)
            return Unauthorized(new { message = "Invalid email or password." });

        if (!string.Equals(user.PasswordHash, request.Password, StringComparison.Ordinal))
            return Unauthorized(new { message = "Invalid email or password." });

        var token = tokenService.CreateToken(user);
        return Ok(new AuthResultDto(token.AccessToken, token.ExpiresAtUtc, user.UserId, user.Email, user.DisplayName ?? ""));
    }

    [HttpPost("signup")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResultDto>> Signup([FromBody] SignupRequest request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim();
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(request.Password))
            return BadRequest(new { message = "Email and password are required." });

        if (await db.AppUsers.AnyAsync(x => x.Email == email, cancellationToken))
            return Conflict(new { message = "An account with this email already exists." });

        var user = new AppUser
        {
            Email = email,
            PasswordHash = request.Password,
            DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? null : request.DisplayName.Trim(),
        };
        await db.AddAsync(user, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        var token = tokenService.CreateToken(user);
        return Ok(new AuthResultDto(token.AccessToken, token.ExpiresAtUtc, user.UserId, user.Email, user.DisplayName ?? ""));
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserProfileDto>> Me(CancellationToken cancellationToken)
    {
        var sub = JwtUserId.FromPrincipal(User);
        if (!Guid.TryParse(sub, out var userId))
            return Unauthorized();

        var user = await db.AppUsers.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId, cancellationToken);
        if (user is null)
            return Unauthorized();

        return Ok(new UserProfileDto(user.Email, user.DisplayName ?? ""));
    }
}

[ApiController]
[Authorize]
[Route("api/sites")]
public sealed class SitesController(ITrafficDbContext db) : ControllerBase
{
    private string? UserSub => JwtUserId.FromPrincipal(User);

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<SiteDto>>> List(CancellationToken cancellationToken)
    {
        var sub = UserSub;
        if (string.IsNullOrEmpty(sub))
            return Unauthorized();

        var list = await db.Sites
            .AsNoTracking()
            .Where(s => s.UserId == sub)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SiteDto(s.SiteId, s.Domain, s.Name, s.TrackingKey, s.Platform))
            .ToListAsync(cancellationToken);

        // Backfill tracking keys for any historical site rows missing one (one-time per row).
        var missingKey = list.Any(x => string.IsNullOrEmpty(x.TrackingKey));
        if (missingKey)
        {
            var rows = await db.Sites
                .Where(s => s.UserId == sub && (s.TrackingKey == null || s.TrackingKey == string.Empty))
                .ToListAsync(cancellationToken);
            foreach (var s in rows) s.TrackingKey = TrackingKeyGenerator.New();
            await db.SaveChangesAsync(cancellationToken);

            list = await db.Sites
                .AsNoTracking()
                .Where(s => s.UserId == sub)
                .OrderByDescending(s => s.CreatedAt)
                .Select(s => new SiteDto(s.SiteId, s.Domain, s.Name, s.TrackingKey, s.Platform))
                .ToListAsync(cancellationToken);
        }

        return Ok(list);
    }

    [HttpPost]
    public async Task<ActionResult<SiteDto>> Register([FromBody] RegisterSiteRequest request, CancellationToken cancellationToken)
    {
        var sub = UserSub;
        if (string.IsNullOrEmpty(sub))
            return Unauthorized();

        if (!SiteUrlNormalizer.TryNormalize(request.Url, out var domain, out var err))
            return BadRequest(new { message = err });

        var existing = await db.Sites.FirstOrDefaultAsync(s => s.UserId == sub && s.Domain == domain, cancellationToken);
        if (existing is not null)
        {
            if (string.IsNullOrEmpty(existing.TrackingKey))
            {
                existing.TrackingKey = TrackingKeyGenerator.New();
            }
            if (request.Platform.HasValue)
            {
                existing.Platform = request.Platform.Value;
            }
            if (!string.IsNullOrWhiteSpace(request.Name))
            {
                existing.Name = request.Name.Trim();
            }
            await db.SaveChangesAsync(cancellationToken);
            return Ok(new SiteDto(existing.SiteId, existing.Domain, existing.Name, existing.TrackingKey, existing.Platform));
        }

        var site = new Site
        {
            UserId = sub,
            Domain = domain,
            Name = string.IsNullOrWhiteSpace(request.Name) ? domain : request.Name.Trim(),
            Platform = request.Platform ?? SitePlatform.Other,
            TrackingKey = TrackingKeyGenerator.New(),
        };
        await db.AddAsync(site, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new SiteDto(site.SiteId, site.Domain, site.Name, site.TrackingKey, site.Platform));
    }

    [HttpGet("detect")]
    public async Task<ActionResult<PlatformDetectionResultDto>> DetectPlatform([FromQuery] string url, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(url))
            return BadRequest(new { message = "URL is required." });

        if (!SiteUrlNormalizer.TryNormalize(url, out var domain, out var err))
            return BadRequest(new { message = err });

        var platform = SitePlatform.Other;
        var lowerDomain = domain.ToLowerInvariant();

        if (lowerDomain.Contains("wordpress") || lowerDomain.EndsWith(".wp"))
        {
            platform = SitePlatform.WordPress;
        }
        else if (lowerDomain.Contains("shopify") || lowerDomain.EndsWith("myshopify.com"))
        {
            platform = SitePlatform.Shopify;
        }
        else if (lowerDomain.Contains("wixsite") || lowerDomain.Contains("wix"))
        {
            platform = SitePlatform.Wix;
        }
        else if (lowerDomain.Contains("squarespace"))
        {
            platform = SitePlatform.Squarespace;
        }
        else if (lowerDomain.Contains("vercel.app") || lowerDomain.Contains("vercel"))
        {
            platform = SitePlatform.Vercel;
        }
        else if (lowerDomain.Contains("railway.app") || lowerDomain.Contains("railway"))
        {
            platform = SitePlatform.Railway;
        }

        if (platform == SitePlatform.Other)
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) ScribeCountDetector/1.0");
            client.Timeout = TimeSpan.FromSeconds(5);
            try
            {
                string html = "";
                HttpResponseMessage? response = null;
                try
                {
                    response = await client.GetAsync("https://" + domain, cancellationToken);
                }
                catch
                {
                    response = await client.GetAsync("http://" + domain, cancellationToken);
                }

                if (response != null)
                {
                    // Check HTTP headers first (e.g. Vercel)
                    if (response.Headers.Contains("x-vercel-id") || 
                        response.Headers.Contains("x-vercel-cache") || 
                        response.Headers.Server.ToString().Contains("Vercel"))
                    {
                        platform = SitePlatform.Vercel;
                    }
                    else
                    {
                        html = await response.Content.ReadAsStringAsync(cancellationToken);
                        if (html.Contains("/wp-content/") || html.Contains("/wp-includes/") || html.Contains("wp-submit"))
                        {
                            platform = SitePlatform.WordPress;
                        }
                        else if (html.Contains("cdn.shopify.com") || html.Contains("shopify-features") || html.Contains("Shopify.shop"))
                        {
                            platform = SitePlatform.Shopify;
                        }
                        else if (html.Contains("wix.com") || html.Contains("wixsite") || html.Contains("wix-code") || html.Contains("wix-elements"))
                        {
                            platform = SitePlatform.Wix;
                        }
                        else if (html.Contains("static1.squarespace.com") || html.Contains("squarespace-headers") || html.Contains("Squarespace.ON_DOC_READY"))
                        {
                            platform = SitePlatform.Squarespace;
                        }
                        else if (html.Contains("__NEXT_DATA__") || html.Contains("vercel-speed-insights") || html.Contains("_next/static"))
                        {
                            platform = SitePlatform.Vercel;
                        }
                        else if (html.Contains("railway.app") || html.Contains("railway-icon"))
                        {
                            platform = SitePlatform.Railway;
                        }
                    }
                }
            }
            catch
            {
                // Ignore network errors, fallback to domain-based
            }
        }

        return Ok(new PlatformDetectionResultDto(platform));
    }

    [HttpPost("{siteId:guid}/verify")]
    public async Task<ActionResult<VerifyResultDto>> Verify(Guid siteId, CancellationToken cancellationToken)
    {
        var sub = UserSub;
        if (string.IsNullOrEmpty(sub))
            return Unauthorized();

        var site = await db.Sites
            .FirstOrDefaultAsync(s => s.SiteId == siteId && s.UserId == sub, cancellationToken);
        if (site is null) return NotFound();

        // 1. Check if database has any events for this site
        var hasEvents = await db.Events.AnyAsync(e => e.SiteId == siteId, cancellationToken);
        if (hasEvents)
        {
            return Ok(new VerifyResultDto(site.SiteId, true, "Active events detected in the database."));
        }

        // 2. Fallback: HTTP ping to inspect HTML
        using var client = new HttpClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd("Mozilla/5.0 (Windows NT 10.0; Win64; x64) ScribeCountVerifier/1.0");
        client.Timeout = TimeSpan.FromSeconds(10);

        try
        {
            string html = "";
            try
            {
                html = await client.GetStringAsync("https://" + site.Domain, cancellationToken);
            }
            catch
            {
                html = await client.GetStringAsync("http://" + site.Domain, cancellationToken);
            }

            bool containsSnippet = html.Contains(site.TrackingKey);
            if (containsSnippet)
            {
                return Ok(new VerifyResultDto(site.SiteId, true, "Snippet detected successfully via page source scan."));
            }

            return Ok(new VerifyResultDto(site.SiteId, false, "Tracking snippet not found in page HTML source."));
        }
        catch (Exception ex)
        {
            return Ok(new VerifyResultDto(site.SiteId, false, $"Could not reach site: {ex.Message}"));
        }
    }

    /// <summary>
    /// Rotate the tracking key. The old key stops accepting events immediately.
    /// </summary>
    [HttpPost("{siteId:guid}/tracking-key/rotate")]
    public async Task<ActionResult<TrackingKeyDto>> RotateKey(Guid siteId, CancellationToken cancellationToken)
    {
        var sub = UserSub;
        if (string.IsNullOrEmpty(sub))
            return Unauthorized();

        var site = await db.Sites
            .FirstOrDefaultAsync(s => s.SiteId == siteId && s.UserId == sub, cancellationToken);
        if (site is null) return NotFound();

        site.TrackingKey = TrackingKeyGenerator.New();
        await db.SaveChangesAsync(cancellationToken);
        return Ok(new TrackingKeyDto(site.SiteId, site.TrackingKey));
    }
}

[ApiController]
[Authorize]
[Route("api/onboarding")]
public sealed class OnboardingController : ControllerBase
{
    [HttpGet]
    public ActionResult<OnboardingDto> Get()
    {
        return Ok(new OnboardingDto(
            HeroTitle: "Get started in 5 easy steps",
            HeroCopy: "We’ll walk you through how website tracking works, how to connect your first site, and how to see real analytics immediately.",
            Steps: new[]
            {
                new OnboardingStepDto(
                    Title: "Register your first website",
                    Description: "Paste the website URL and click Track to create a new property with a tracking key.",
                    Highlight: "This creates the site record so traffic can be captured and attributed to your property."),
                new OnboardingStepDto(
                    Title: "Select the site in the dashboard",
                    Description: "Choose your newly registered website from the site switcher in the top bar.",
                    Highlight: "Selecting the active site ensures the right data appears in Overview, Traffic, and Heatmaps."),
                new OnboardingStepDto(
                    Title: "Install the tracking snippet",
                    Description: "Copy the snippet from Settings and paste it into your website footer before </body>.",
                    Highlight: "This snippet sends pageviews, clicks, scroll events, and conversion events back to the dashboard."),
                new OnboardingStepDto(
                    Title: "Watch real traffic arrive",
                    Description: "Open the live site in a new browser tab and return to the Overview or Traffic page.",
                    Highlight: "Data appears almost immediately so you can validate the connection and review sessions."),
                new OnboardingStepDto(
                    Title: "Explore Funnels and Heatmaps",
                    Description: "Inspect visitor behavior, conversion drops, and where users click on your pages.",
                    Highlight: "Funnels and Heatmaps help you optimize the site experience and increase conversions.")
            }));
    }
}

public sealed record OnboardingDto(IReadOnlyList<OnboardingStepDto> Steps, string HeroTitle, string HeroCopy);
public sealed record OnboardingStepDto(string Title, string Description, string Highlight);

internal static class TrackingKeyGenerator
{
    public static string New()
    {
        Span<byte> buf = stackalloc byte[24];
        System.Security.Cryptography.RandomNumberGenerator.Fill(buf);
        // url-safe Base64 (no '+' '/' '=')
        var s = Convert.ToBase64String(buf).Replace('+', '-').Replace('/', '_').TrimEnd('=');
        return "sc_live_" + s;
    }
}

[ApiController]
[Route("api/collect")]
[EnableCors("Public")]
public sealed class CollectController(
    IEventCollectionService eventCollectionService,
    IValidator<CollectEventRequest> validator) : ControllerBase
{
    [HttpPost]
    [HttpPost("/api/track")]
    [AllowAnonymous]
    [EnableRateLimiting("collect")]
    public async Task<ActionResult<EventCollectionResult>> Collect([FromBody] CollectEventRequest request, CancellationToken cancellationToken)
    {
        // Tracking key may arrive in the body (preferred for the JS SDK) or as an X-Tracking-Key
        // header (useful for server-to-server callers that don't want to mutate the body shape).
        var headerKey = Request.Headers["X-Tracking-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(request.TrackingKey) && !string.IsNullOrWhiteSpace(headerKey))
        {
            request = request with { TrackingKey = headerKey };
        }

        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(x => x.ErrorMessage));

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0";
        var ua = Request.Headers.UserAgent.ToString();
        var referrer = Request.Headers.Referer.ToString();
        var countryHint = Request.Headers["CF-IPCountry"].FirstOrDefault()
            ?? Request.Headers["CloudFront-Viewer-Country"].FirstOrDefault()
            ?? Request.Headers["True-Client-Country"].FirstOrDefault();
        try
        {
            var result = await eventCollectionService.CollectAsync(request, ip, ua, referrer, cancellationToken, countryHint);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

[ApiController]
[Authorize]
[Route("api/traffic")]
public sealed class TrafficController(
    ITrafficDbContext db,
    IAnalyticsService analyticsService,
    IFunnelService funnelService,
    IHeatmapService heatmapService) : ControllerBase
{
    private async Task<bool> OwnsSiteAsync(Guid siteId, CancellationToken cancellationToken)
    {
        var sub = JwtUserId.FromPrincipal(User);
        if (string.IsNullOrEmpty(sub))
            return false;
        return await db.Sites.AnyAsync(s => s.SiteId == siteId && s.UserId == sub, cancellationToken);
    }

    [HttpGet("overview")]
    public async Task<ActionResult<TrafficOverviewResponse>> Overview([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetOverviewAsync(siteId, days, cancellationToken));
    }

    [HttpGet("sources")]
    public async Task<ActionResult<IReadOnlyList<SourcePoint>>> Sources([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetSourcesAsync(siteId, days, cancellationToken));
    }

    [HttpGet("pages")]
    public async Task<ActionResult<IReadOnlyList<PagePoint>>> Pages([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetPagesAsync(siteId, days, cancellationToken));
    }

    [HttpGet("conversions")]
    public async Task<ActionResult<IReadOnlyList<ConversionPoint>>> Conversions([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetConversionsAsync(siteId, days, cancellationToken));
    }

    [HttpGet("devices")]
    public async Task<ActionResult<IReadOnlyList<DevicePoint>>> Devices([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetDevicesAsync(siteId, days, cancellationToken));
    }

    [HttpGet("countries")]
    public async Task<ActionResult<IReadOnlyList<CountryPoint>>> Countries([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetCountriesAsync(siteId, days, cancellationToken));
    }

    [HttpGet("referrers")]
    public async Task<ActionResult<IReadOnlyList<ReferrerPoint>>> Referrers([FromQuery] Guid siteId, [FromQuery] int days = 30, [FromQuery] int take = 20, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetReferrersAsync(siteId, days, take, cancellationToken));
    }

    [HttpGet("campaigns")]
    public async Task<ActionResult<IReadOnlyList<CampaignPoint>>> Campaigns([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await analyticsService.GetCampaignsAsync(siteId, days, cancellationToken));
    }

    [HttpGet("funnels")]
    public async Task<ActionResult<IReadOnlyList<FunnelStepDto>>> Funnels(
        [FromQuery] Guid siteId,
        [FromQuery] string steps,
        [FromQuery] int days = 30,
        CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await funnelService.CalculateAsync(siteId, steps.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), days, cancellationToken));
    }

    [HttpGet("heatmap")]
    public async Task<ActionResult<IReadOnlyList<HeatmapPointDto>>> Heatmap(
        [FromQuery] Guid siteId,
        [FromQuery] string pageUrl,
        [FromQuery] int days = 30,
        CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();
        return Ok(await heatmapService.GetPageHeatmapAsync(siteId, pageUrl, days, cancellationToken));
    }

    [HttpGet("live")]
    public async Task<ActionResult<LiveStatsDto>> LiveStats([FromQuery] Guid siteId, CancellationToken cancellationToken = default)
    {
        if (!await OwnsSiteAsync(siteId, cancellationToken)) return Forbid();

        var since = DateTime.UtcNow.AddMinutes(-30);
        var today = DateTime.UtcNow.Date;

        var activeVisitors = await db.Sessions
            .Where(s => s.SiteId == siteId && s.LastActivityAt >= since)
            .Select(s => s.VisitorId)
            .Distinct()
            .CountAsync(cancellationToken);

        var todayEvents = await db.Events
            .Where(e => e.SiteId == siteId && e.Timestamp >= today)
            .CountAsync(cancellationToken);

        var todayClicks = await db.Events
            .Where(e => e.SiteId == siteId && e.Timestamp >= today && e.EventType == EventType.Click)
            .CountAsync(cancellationToken);

        var todayPageViews = await db.PageViews
            .Where(p => p.SiteId == siteId && p.Timestamp >= today)
            .CountAsync(cancellationToken);

        var todayConversions = await db.Conversions
            .Where(c => c.SiteId == siteId && c.Timestamp >= today)
            .CountAsync(cancellationToken);

        var totalSessions = await db.Sessions
            .Where(s => s.SiteId == siteId && s.StartedAt >= today)
            .CountAsync(cancellationToken);

        // Engagement = sessions that had at least one click event today
        var clickSessionIds = await db.Events
            .Where(e => e.SiteId == siteId && e.Timestamp >= today && e.EventType == EventType.Click)
            .Select(e => e.SessionId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var convSessionIds = await db.Conversions
            .Where(c => c.SiteId == siteId && c.Timestamp >= today)
            .Select(c => c.SessionId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var engagedCount = clickSessionIds.Union(convSessionIds).Count();
        var engagementRate = totalSessions > 0 ? Math.Round((double)engagedCount / totalSessions * 100, 1) : 0;

        return Ok(new LiveStatsDto(
            ActiveVisitors: activeVisitors,
            TodayEvents: todayEvents,
            TodayClicks: todayClicks,
            TodayPageViews: todayPageViews,
            TodayConversions: todayConversions,
            EngagementRate: engagementRate
        ));
    }
}

public sealed record LiveStatsDto(
    int ActiveVisitors,
    int TodayEvents,
    int TodayClicks,
    int TodayPageViews,
    int TodayConversions,
    double EngagementRate);
