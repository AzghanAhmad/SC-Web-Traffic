using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace SCWebTraffic.Infrastructure;

public sealed class DesignTimeFactory : IDesignTimeDbContextFactory<TrafficDbContext>
{
    public TrafficDbContext CreateDbContext(string[] args)
    {
        const string connection = "Server=localhost;Port=3306;Database=sc_web_traffic;User=root;Password=;";
        var optionsBuilder = new DbContextOptionsBuilder<TrafficDbContext>();
        optionsBuilder.UseMySql(connection, new MySqlServerVersion(new Version(8, 0, 36)));
        return new TrafficDbContext(optionsBuilder.Options);
    }
}
