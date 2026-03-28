using SCWebTraffic.Application;
using SCWebTraffic.Infrastructure;
using SCWebTraffic.Worker;

var builder = Host.CreateApplicationBuilder(args);
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHostedService<SessionFinalizerHostedService>();
builder.Services.AddHostedService<DailySnapshotHostedService>();
builder.Services.AddHostedService<DataCleanupHostedService>();

using var host = builder.Build();
using (var scope = host.Services.CreateScope())
{
    var schema = scope.ServiceProvider.GetRequiredService<ISchemaInitializer>();
    await schema.InitializeAsync();
}

host.Run();
