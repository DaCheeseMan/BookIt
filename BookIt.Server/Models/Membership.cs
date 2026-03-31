namespace BookIt.Server.Models;

public enum TenantMemberRole { Member = 0, Admin = 1 }

public class Membership
{
    public int Id { get; set; }
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public TenantMemberRole Role { get; set; } = TenantMemberRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
