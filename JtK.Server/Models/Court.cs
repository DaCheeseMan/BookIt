namespace JtK.Server.Models;

public class Court
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Surface { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
