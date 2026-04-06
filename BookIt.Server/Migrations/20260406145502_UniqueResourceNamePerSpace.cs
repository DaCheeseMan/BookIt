using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookIt.Server.Migrations
{
    /// <inheritdoc />
    public partial class UniqueResourceNamePerSpace : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Resources_SpaceId",
                table: "Resources");

            migrationBuilder.CreateIndex(
                name: "IX_Resources_SpaceId_Name",
                table: "Resources",
                columns: new[] { "SpaceId", "Name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Resources_SpaceId_Name",
                table: "Resources");

            migrationBuilder.CreateIndex(
                name: "IX_Resources_SpaceId",
                table: "Resources",
                column: "SpaceId");
        }
    }
}
