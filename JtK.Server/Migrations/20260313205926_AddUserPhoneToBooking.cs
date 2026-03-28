using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace JtK.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddUserPhoneToBooking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "UserPhone",
                table: "Bookings",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "UserPhone",
                table: "Bookings");
        }
    }
}
