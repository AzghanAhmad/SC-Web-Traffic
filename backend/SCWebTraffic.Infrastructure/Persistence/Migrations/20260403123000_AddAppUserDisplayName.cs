using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using SCWebTraffic.Infrastructure;

#nullable disable

namespace SCWebTraffic.Infrastructure.Persistence.Migrations;

[DbContext(typeof(TrafficDbContext))]
[Migration("20260403123000_AddAppUserDisplayName")]
public partial class AddAppUserDisplayName : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(
            name: "DisplayName",
            table: "AppUsersSet",
            type: "varchar(120)",
            maxLength: 120,
            nullable: true)
            .Annotation("MySql:CharSet", "utf8mb4");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "DisplayName", table: "AppUsersSet");
    }
}
