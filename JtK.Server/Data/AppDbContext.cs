using JtK.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace JtK.Server.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Court> Courts => Set<Court>();
    public DbSet<Booking> Bookings => Set<Booking>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Court>().HasData(
            new Court { Id = 1, Name = "Bana 1", Surface = "Clay", Description = "Utomhusbana med grusunderlag.", IsActive = true },
            new Court { Id = 2, Name = "Bana 2", Surface = "Clay", Description = "Utomhusbana med grusunderlag.", IsActive = true },
            new Court { Id = 3, Name = "Bana 3", Surface = "Hard", Description = "Inomhusbana med hårt underlag.", IsActive = true }
        );
    }
}
