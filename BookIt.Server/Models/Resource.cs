namespace BookIt.Server.Models;

public class Resource
{
    public int Id { get; set; }
    public int SpaceId { get; set; }
    public Space Space { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string ResourceType { get; set; } = string.Empty;
    public int SlotDurationMinutes { get; set; } = 60;
    public int MaxAdvanceDays { get; set; } = 30;
    public bool IsActive { get; set; } = true;
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
