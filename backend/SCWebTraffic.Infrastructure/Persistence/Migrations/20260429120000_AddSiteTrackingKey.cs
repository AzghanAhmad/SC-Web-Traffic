using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SCWebTraffic.Infrastructure;

#nullable disable

namespace SCWebTraffic.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrafficDbContext))]
[Migration("20260429120000_AddSiteTrackingKey")]
public partial class AddSiteTrackingKey : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // 1) Add the column (allow empty for now so existing rows pass NOT NULL).
        migrationBuilder.AddColumn<string>(
            name: "TrackingKey",
            table: "SitesSet",
            type: "varchar(64)",
            maxLength: 64,
            nullable: false,
            defaultValue: "")
            .Annotation("MySql:CharSet", "utf8mb4");

        // 2) Backfill any pre-existing rows with a unique key. Use UUID() so we don't depend on
        //    server-side functions other than what MySQL provides natively. Format is consistent
        //    with TrackingKeyGenerator: prefix + url-safe-ish chars.
        migrationBuilder.Sql(
            "UPDATE SitesSet " +
            "SET TrackingKey = CONCAT('sc_live_', LOWER(REPLACE(UUID(), '-', ''))) " +
            "WHERE TrackingKey IS NULL OR TrackingKey = '';");

        // 3) Now that every row has a unique value, enforce uniqueness.
        migrationBuilder.CreateIndex(
            name: "IX_SitesSet_TrackingKey",
            table: "SitesSet",
            column: "TrackingKey",
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_SitesSet_TrackingKey", table: "SitesSet");
        migrationBuilder.DropColumn(name: "TrackingKey", table: "SitesSet");
    }
}
