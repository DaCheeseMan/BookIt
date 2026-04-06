using BookIt.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace BookIt.Server.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Space> Spaces => Set<Space>();
    public DbSet<Resource> Resources => Set<Resource>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<Membership> Memberships => Set<Membership>();
    public DbSet<Invitation> Invitations => Set<Invitation>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Space>()
            .HasIndex(s => s.Slug)
            .IsUnique();

        modelBuilder.Entity<Resource>()
            .HasOne(r => r.Space)
            .WithMany(s => s.Resources)
            .HasForeignKey(r => r.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Resource>()
            .HasIndex(r => new { r.SpaceId, r.Name })
            .IsUnique();

        modelBuilder.Entity<Booking>()
            .HasOne(b => b.Resource)
            .WithMany(r => r.Bookings)
            .HasForeignKey(b => b.ResourceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Membership>()
            .HasOne(m => m.Space)
            .WithMany(s => s.Memberships)
            .HasForeignKey(m => m.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Membership>()
            .HasIndex(m => new { m.SpaceId, m.UserId })
            .IsUnique();

        modelBuilder.Entity<Invitation>()
            .HasOne(i => i.Space)
            .WithMany()
            .HasForeignKey(i => i.SpaceId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Invitation>()
            .HasIndex(i => i.Token)
            .IsUnique();
    }
}
