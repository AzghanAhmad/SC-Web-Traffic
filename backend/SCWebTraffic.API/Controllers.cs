using FluentValidation;
using Microsoft.AspNetCore.Authorization;
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
            .Select(s => new SiteDto(s.SiteId, s.Domain, s.Name))
            .ToListAsync(cancellationToken);

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
            return Ok(new SiteDto(existing.SiteId, existing.Domain, existing.Name));

        var site = new Site
        {
            UserId = sub,
            Domain = domain,
            Name = domain,
            Platform = SitePlatform.Other,
        };
        await db.AddAsync(site, cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new SiteDto(site.SiteId, site.Domain, site.Name));
    }
}

[ApiController]
[Route("api/collect")]
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
        var validation = await validator.ValidateAsync(request, cancellationToken);
        if (!validation.IsValid)
            return BadRequest(validation.Errors.Select(x => x.ErrorMessage));

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "0.0.0.0";
        var ua = Request.Headers.UserAgent.ToString();
        var referrer = Request.Headers.Referer.ToString();
        var countryHint = Request.Headers["CF-IPCountry"].FirstOrDefault()
            ?? Request.Headers["CloudFront-Viewer-Country"].FirstOrDefault()
            ?? Request.Headers["True-Client-Country"].FirstOrDefault();
        var result = await eventCollectionService.CollectAsync(request, ip, ua, referrer, cancellationToken, countryHint);
        return Ok(result);
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
