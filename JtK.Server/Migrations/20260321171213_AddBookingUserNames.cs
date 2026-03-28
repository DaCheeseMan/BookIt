using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JtK.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddBookingUserNames : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserFirstName",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "UserLastName",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UserFirstName",
                table: "Bookings");

            migrationBuilder.DropColumn(
                name: "UserLastName",
                table: "Bookings");
        }
    }
}
