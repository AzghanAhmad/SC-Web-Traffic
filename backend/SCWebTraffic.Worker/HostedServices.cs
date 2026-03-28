using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SCWebTraffic.Application;

namespace SCWebTraffic.Worker;

public sealed class SessionFinalizerHostedService(
    IServiceProvider serviceProvider,
    ILogger<SessionFinalizerHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = serviceProvider.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<ISessionMaintenanceService>();
            await svc.FinalizeInactiveSessionsAsync(TimeSpan.FromMinutes(30), stoppingToken);
            logger.LogInformation("Session finalizer run completed.");
            await Task.Delay(TimeSpan.FromMinutes(5), stoppingToken);
        }
    }
}

public sealed class DailySnapshotHostedService(
    IServiceProvider serviceProvider,
    ILogger<DailySnapshotHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = serviceProvider.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<ISnapshotService>();
            await svc.CreateDailySnapshotsAsync(DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-1)), stoppingToken);
            logger.LogInformation("Daily snapshot generation completed.");
            await Task.Delay(TimeSpan.FromHours(24), stoppingToken);
        }
    }
}

public sealed class DataCleanupHostedService(
    IServiceProvider serviceProvider,
    ILogger<DataCleanupHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            using var scope = serviceProvider.CreateScope();
            var svc = scope.ServiceProvider.GetRequiredService<IDataCleanupService>();
            await svc.CleanupOldRawEventsAsync(90, stoppingToken);
            logger.LogInformation("Data cleanup job completed.");
            await Task.Delay(TimeSpan.FromHours(12), stoppingToken);
        }
    }
}
