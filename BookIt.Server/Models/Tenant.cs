namespace BookIt.Server.Models;

public enum TenantVisibility { Public = 0, Private = 1 }

public class Tenant
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Slug { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string OwnerId { get; set; } = string.Empty;
    public TenantVisibility Visibility { get; set; } = TenantVisibility.Public;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public ICollection<Resource> Resources { get; set; } = new List<Resource>();
    public ICollection<Membership> Memberships { get; set; } = new List<Membership>();
}
