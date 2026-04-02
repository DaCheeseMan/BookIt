namespace BookIt.Server.Models;

public enum InvitationStatus { Pending = 0, Accepted = 1, Expired = 2, Revoked = 3 }

public class Invitation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int TenantId { get; set; }
    public Tenant Tenant { get; set; } = null!;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Member";
    public string Token { get; set; } = string.Empty;
    public InvitationStatus Status { get; set; } = InvitationStatus.Pending;
    public string InvitedBy { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset? AcceptedAt { get; set; }
    public string? AcceptedByUserId { get; set; }
}
