using AutoMapper;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;
using SCWebTraffic.Domain;
using System.Text.Json;

namespace SCWebTraffic.Application;

public sealed record CollectEventRequest(
    Guid SiteId,
    EventType EventType,
    string PageUrl,
    Dictionary<string, object?>? Metadata,
    DateTime? Timestamp);

public sealed record AuthRequest(string Email, string Password);
public sealed record SignupRequest(string Email, string Password, string? DisplayName);
public sealed record AuthResponse(string AccessToken, DateTime ExpiresAtUtc);
public sealed record AuthResultDto(string AccessToken, DateTime ExpiresAtUtc, Guid UserId, string Email, string DisplayName);
public sealed record UserProfileDto(string Email, string DisplayName);

public sealed record SiteDto(Guid SiteId, string Domain, string Name);
public sealed record RegisterSiteRequest(string Url);

public sealed record EventCollectionResult(Guid EventId, Guid SessionId, Guid VisitorId);

public sealed record TrendPoint(string Date, int Visitors, int Sessions, int PageViews, int Conversions);
public sealed record SourcePoint(string Source, int Sessions, double Percentage);
public sealed record PagePoint(string PageUrl, int Views, double AvgTimeOnPageSeconds, double BounceRate, int Conversions);
public sealed record DevicePoint(string DeviceType, int Sessions);
public sealed record ConversionPoint(string Type, int Count, decimal? ValueSum);
public sealed record CountryPoint(string Country, int Sessions, double Percentage);
public sealed record ReferrerPoint(string Source, int Visits);
public sealed record CampaignPoint(string Name, int Visits, int Conversions);
public sealed record FunnelStepDto(string Step, int Entered, int Completed, double ConversionRate, double DropOffRate);
public sealed record HeatmapPointDto(int X, int Y, int Count, int AvgScrollDepth);

public sealed record TrafficOverviewResponse(
    int Visitors,
    int Sessions,
    double EngagementRate,
    int Conversions,
    IReadOnlyList<TrendPoint> TrendData);

public interface ITrafficDbContext
{
    IQueryable<Site> Sites { get; }
    IQueryable<Visitor> Visitors { get; }
    IQueryable<Session> Sessions { get; }
    IQueryable<TrafficEvent> Events { get; }
    IQueryable<PageView> PageViews { get; }
    IQueryable<Conversion> Conversions { get; }
    IQueryable<HeatmapData> HeatmapData { get; }
    IQueryable<DailySnapshot> DailySnapshots { get; }
    IQueryable<AppUser> AppUsers { get; }

    Task AddAsync<T>(T entity, CancellationToken cancellationToken = default) where T : class;
    Task AddRangeAsync<T>(IEnumerable<T> entities, CancellationToken cancellationToken = default) where T : class;
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}

public interface IEventCollectionService
{
    Task<EventCollectionResult> CollectAsync(
        CollectEventRequest request,
        string ipAddress,
        string userAgent,
        string? referrer,
        CancellationToken cancellationToken = default,
        string? countryCodeHint = null);
}

public interface IAnalyticsService
{
    Task<TrafficOverviewResponse> GetOverviewAsync(Guid siteId, int days, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SourcePoint>> GetSourcesAsync(Guid siteId, int days, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<PagePoint>> GetPagesAsync(Guid siteId, int days, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ConversionPoint>> GetConversionsAsync(Guid siteId, int days, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<DevicePoint>> GetDevicesAsync(Guid siteId, int days, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CountryPoint>> GetCountriesAsync(Guid siteId, int days, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ReferrerPoint>> GetReferrersAsync(Guid siteId, int days, int take = 20, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CampaignPoint>> GetCampaignsAsync(Guid siteId, int days, CancellationToken cancellationToken = default);
}

public interface IFunnelService
{
    Task<IReadOnlyList<FunnelStepDto>> CalculateAsync(
        Guid siteId,
        IReadOnlyList<string> steps,
        int days,
        CancellationToken cancellationToken = default);
}

public interface IHeatmapService
{
    Task<IReadOnlyList<HeatmapPointDto>> GetPageHeatmapAsync(
        Guid siteId,
        string pageUrl,
        int days,
        CancellationToken cancellationToken = default);
}

public interface ITokenService
{
    AuthResponse CreateToken(AppUser user);
}

public interface ISchemaInitializer
{
    Task InitializeAsync(CancellationToken cancellationToken = default);
}

public interface ISnapshotService
{
    Task CreateDailySnapshotsAsync(DateOnly day, CancellationToken cancellationToken = default);
}

public interface ISessionMaintenanceService
{
    Task FinalizeInactiveSessionsAsync(TimeSpan timeout, CancellationToken cancellationToken = default);
}

public interface IDataCleanupService
{
    Task CleanupOldRawEventsAsync(int olderThanDays, CancellationToken cancellationToken = default);
}

public sealed class CollectEventRequestValidator : AbstractValidator<CollectEventRequest>
{
    public CollectEventRequestValidator()
    {
        RuleFor(x => x.SiteId).NotEmpty();
        RuleFor(x => x.PageUrl).NotEmpty().MaximumLength(1024).Must(url =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri) &&
            (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps));
        RuleFor(x => x.Metadata)
            .Must(m => m is null || JsonSerializer.Serialize(m).Length <= 6000)
            .WithMessage("Metadata payload too large.");
        RuleFor(x => x.Timestamp)
            .Must(t => !t.HasValue || t.Value > DateTime.UtcNow.AddDays(-7))
            .WithMessage("Timestamp is too old.");
    }
}

public sealed class ApplicationMappingProfile : Profile
{
    public ApplicationMappingProfile()
    {
        CreateMap<TrafficEvent, TrendPoint>()
            .ForCtorParam(nameof(TrendPoint.Date), opt => opt.MapFrom(x => x.Timestamp.ToString("yyyy-MM-dd")))
            .ForCtorParam(nameof(TrendPoint.Visitors), opt => opt.MapFrom(_ => 0))
            .ForCtorParam(nameof(TrendPoint.Sessions), opt => opt.MapFrom(_ => 0))
            .ForCtorParam(nameof(TrendPoint.PageViews), opt => opt.MapFrom(_ => 0))
            .ForCtorParam(nameof(TrendPoint.Conversions), opt => opt.MapFrom(_ => 0));
    }
}

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddAutoMapper(cfg => cfg.AddProfile<ApplicationMappingProfile>());
        services.AddValidatorsFromAssemblyContaining<CollectEventRequestValidator>();
        return services;
    }
}
