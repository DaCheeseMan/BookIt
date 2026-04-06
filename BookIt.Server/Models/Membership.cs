namespace BookIt.Server.Models;

public enum SpaceMemberRole { Member = 0, Admin = 1 }

public class Membership
{
    public int Id { get; set; }
    public int SpaceId { get; set; }
    public Space Space { get; set; } = null!;
    public string UserId { get; set; } = string.Empty;
    public SpaceMemberRole Role { get; set; } = SpaceMemberRole.Member;
    public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
}
