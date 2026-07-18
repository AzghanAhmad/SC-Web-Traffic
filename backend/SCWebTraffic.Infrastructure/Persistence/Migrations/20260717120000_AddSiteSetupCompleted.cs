using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SCWebTraffic.Infrastructure;

#nullable disable

namespace SCWebTraffic.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrafficDbContext))]
[Migration("20260717120000_AddSiteSetupCompleted")]
public partial class AddSiteSetupCompleted : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Existing sites are already connected, so default them to completed (true).
        // New sites created mid-wizard are inserted with an explicit false by the app until verified.
        migrationBuilder.AddColumn<bool>(
            name: "SetupCompleted",
            table: "SitesSet",
            type: "tinyint(1)",
            nullable: false,
            defaultValue: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "SetupCompleted", table: "SitesSet");
    }
}
