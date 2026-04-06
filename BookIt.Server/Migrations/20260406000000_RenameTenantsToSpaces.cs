using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookIt.Server.Migrations
{
    /// <inheritdoc />
    public partial class RenameTenantsToSpaces : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Drop FK constraints that reference Tenants before renaming
            migrationBuilder.DropForeignKey(
                name: "FK_Invitations_Tenants_TenantId",
                table: "Invitations");

            migrationBuilder.DropForeignKey(
                name: "FK_Memberships_Tenants_TenantId",
                table: "Memberships");

            migrationBuilder.DropForeignKey(
                name: "FK_Resources_Tenants_TenantId",
                table: "Resources");

            // Drop old indexes on TenantId columns
            migrationBuilder.DropIndex(
                name: "IX_Resources_TenantId",
                table: "Resources");

            migrationBuilder.DropIndex(
                name: "IX_Memberships_TenantId_UserId",
                table: "Memberships");

            migrationBuilder.DropIndex(
                name: "IX_Invitations_TenantId",
                table: "Invitations");

            // Rename columns TenantId → SpaceId
            migrationBuilder.RenameColumn(
                name: "TenantId",
                table: "Resources",
                newName: "SpaceId");

            migrationBuilder.RenameColumn(
                name: "TenantId",
                table: "Bookings",
                newName: "SpaceId");

            migrationBuilder.RenameColumn(
                name: "TenantId",
                table: "Memberships",
                newName: "SpaceId");

            migrationBuilder.RenameColumn(
                name: "TenantId",
                table: "Invitations",
                newName: "SpaceId");

            // Rename the Tenants table to Spaces
            migrationBuilder.RenameTable(
                name: "Tenants",
                newName: "Spaces");

            // Rename the unique index on Slug
            migrationBuilder.RenameIndex(
                name: "IX_Tenants_Slug",
                table: "Spaces",
                newName: "IX_Spaces_Slug");

            // Re-create indexes with new names
            migrationBuilder.CreateIndex(
                name: "IX_Resources_SpaceId",
                table: "Resources",
                column: "SpaceId");

            migrationBuilder.CreateIndex(
                name: "IX_Memberships_SpaceId_UserId",
                table: "Memberships",
                columns: new[] { "SpaceId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_SpaceId",
                table: "Invitations",
                column: "SpaceId");

            // Re-add FK constraints with new names
            migrationBuilder.AddForeignKey(
                name: "FK_Invitations_Spaces_SpaceId",
                table: "Invitations",
                column: "SpaceId",
                principalTable: "Spaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Memberships_Spaces_SpaceId",
                table: "Memberships",
                column: "SpaceId",
                principalTable: "Spaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Resources_Spaces_SpaceId",
                table: "Resources",
                column: "SpaceId",
                principalTable: "Spaces",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Invitations_Spaces_SpaceId",
                table: "Invitations");

            migrationBuilder.DropForeignKey(
                name: "FK_Memberships_Spaces_SpaceId",
                table: "Memberships");

            migrationBuilder.DropForeignKey(
                name: "FK_Resources_Spaces_SpaceId",
                table: "Resources");

            migrationBuilder.DropIndex(
                name: "IX_Resources_SpaceId",
                table: "Resources");

            migrationBuilder.DropIndex(
                name: "IX_Memberships_SpaceId_UserId",
                table: "Memberships");

            migrationBuilder.DropIndex(
                name: "IX_Invitations_SpaceId",
                table: "Invitations");

            migrationBuilder.RenameColumn(
                name: "SpaceId",
                table: "Resources",
                newName: "TenantId");

            migrationBuilder.RenameColumn(
                name: "SpaceId",
                table: "Bookings",
                newName: "TenantId");

            migrationBuilder.RenameColumn(
                name: "SpaceId",
                table: "Memberships",
                newName: "TenantId");

            migrationBuilder.RenameColumn(
                name: "SpaceId",
                table: "Invitations",
                newName: "TenantId");

            migrationBuilder.RenameTable(
                name: "Spaces",
                newName: "Tenants");

            migrationBuilder.RenameIndex(
                name: "IX_Spaces_Slug",
                table: "Tenants",
                newName: "IX_Tenants_Slug");

            migrationBuilder.CreateIndex(
                name: "IX_Resources_TenantId",
                table: "Resources",
                column: "TenantId");

            migrationBuilder.CreateIndex(
                name: "IX_Memberships_TenantId_UserId",
                table: "Memberships",
                columns: new[] { "TenantId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Invitations_TenantId",
                table: "Invitations",
                column: "TenantId");

            migrationBuilder.AddForeignKey(
                name: "FK_Invitations_Tenants_TenantId",
                table: "Invitations",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Memberships_Tenants_TenantId",
                table: "Memberships",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Resources_Tenants_TenantId",
                table: "Resources",
                column: "TenantId",
                principalTable: "Tenants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
