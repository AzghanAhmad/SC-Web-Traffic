using FluentValidation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SCWebTraffic.Application;
using SCWebTraffic.Domain;

namespace SCWebTraffic.API;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController(ITrafficDbContext db, ITokenService tokenService) : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] AuthRequest request, CancellationToken cancellationToken)
    {
        var user = await db.AppUsers.FirstOrDefaultAsync(x => x.Email == request.Email, cancellationToken);
        if (user is null)
        {
            // Bootstrap admin user for local use.
            user = new AppUser { Email = request.Email, PasswordHash = request.Password };
            await db.AddAsync(user, cancellationToken);
            await db.SaveChangesAsync(cancellationToken);
        }

        if (!string.Equals(user.PasswordHash, request.Password, StringComparison.Ordinal))
            return Unauthorized("Invalid credentials.");

        return Ok(tokenService.CreateToken(user));
    }
}

[ApiController]
[Route("api/collect")]
public sealed class CollectController(
    IEventCollectionService eventCollectionService,
    IValidator<CollectEventRequest> validator) : ControllerBase
{
    [HttpPost]
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
        var result = await eventCollectionService.CollectAsync(request, ip, ua, referrer, cancellationToken);
        return Ok(result);
    }
}

[ApiController]
[Authorize]
[Route("api/traffic")]
public sealed class TrafficController(
    IAnalyticsService analyticsService,
    IFunnelService funnelService,
    IHeatmapService heatmapService) : ControllerBase
{
    [HttpGet("overview")]
    public Task<TrafficOverviewResponse> Overview([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default) =>
        analyticsService.GetOverviewAsync(siteId, days, cancellationToken);

    [HttpGet("sources")]
    public Task<IReadOnlyList<SourcePoint>> Sources([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default) =>
        analyticsService.GetSourcesAsync(siteId, days, cancellationToken);

    [HttpGet("pages")]
    public Task<IReadOnlyList<PagePoint>> Pages([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default) =>
        analyticsService.GetPagesAsync(siteId, days, cancellationToken);

    [HttpGet("conversions")]
    public Task<IReadOnlyList<ConversionPoint>> Conversions([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default) =>
        analyticsService.GetConversionsAsync(siteId, days, cancellationToken);

    [HttpGet("devices")]
    public Task<IReadOnlyList<DevicePoint>> Devices([FromQuery] Guid siteId, [FromQuery] int days = 30, CancellationToken cancellationToken = default) =>
        analyticsService.GetDevicesAsync(siteId, days, cancellationToken);

    [HttpGet("funnels")]
    public Task<IReadOnlyList<FunnelStepDto>> Funnels(
        [FromQuery] Guid siteId,
        [FromQuery] string steps,
        [FromQuery] int days = 30,
        CancellationToken cancellationToken = default) =>
        funnelService.CalculateAsync(siteId, steps.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries), days, cancellationToken);

    [HttpGet("heatmap")]
    public Task<IReadOnlyList<HeatmapPointDto>> Heatmap(
        [FromQuery] Guid siteId,
        [FromQuery] string pageUrl,
        [FromQuery] int days = 30,
        CancellationToken cancellationToken = default) =>
        heatmapService.GetPageHeatmapAsync(siteId, pageUrl, days, cancellationToken);
}
