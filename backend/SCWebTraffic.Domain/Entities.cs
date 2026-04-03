using System.ComponentModel.DataAnnotations;

namespace SCWebTraffic.Domain;

public enum SitePlatform
{
    WordPress = 1,
    Shopify = 2,
    Wix = 3,
    Other = 4
}

public enum EventType
{
    PageView = 1,
    Click = 2,
    Scroll = 3,
    Conversion = 4
}

public enum DeviceType
{
    Desktop = 1,
    Mobile = 2,
    Tablet = 3,
    Unknown = 4
}

public enum ConversionType
{
    Signup = 1,
    BuyClick = 2,
    Purchase = 3
}

public sealed class Site
{
    [Key]
    public Guid SiteId { get; set; } = Guid.NewGuid();
    [MaxLength(128)]
    public string UserId { get; set; } = string.Empty;
    [MaxLength(150)]
    public string Name { get; set; } = string.Empty;
    [MaxLength(256)]
    public string Domain { get; set; } = string.Empty;
    public SitePlatform Platform { get; set; } = SitePlatform.Other;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class Visitor
{
    [Key]
    public Guid VisitorId { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    [MaxLength(100)]
    public string AnonymousId { get; set; } = string.Empty;
    public DateTime FirstSeenAt { get; set; } = DateTime.UtcNow;
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;
}

public sealed class Session
{
    [Key]
    public Guid SessionId { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    public Guid VisitorId { get; set; }
    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? EndedAt { get; set; }
    public DeviceType DeviceType { get; set; } = DeviceType.Unknown;
    [MaxLength(80)]
    public string Country { get; set; } = "Unknown";
    [MaxLength(512)]
    public string Referrer { get; set; } = string.Empty;
    [MaxLength(100)]
    public string Source { get; set; } = "direct";
    [MaxLength(100)]
    public string Medium { get; set; } = "none";
    [MaxLength(100)]
    public string Campaign { get; set; } = string.Empty;
    public DateTime LastActivityAt { get; set; } = DateTime.UtcNow;
}

public sealed class TrafficEvent
{
    [Key]
    public Guid EventId { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    public Guid SessionId { get; set; }
    public Guid VisitorId { get; set; }
    public EventType EventType { get; set; }
    [MaxLength(100)]
    public string EventName { get; set; } = string.Empty;
    [MaxLength(1024)]
    public string PageUrl { get; set; } = string.Empty;
    public string Metadata { get; set; } = "{}";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public sealed class PageView
{
    [Key]
    public Guid PageViewId { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    public Guid SessionId { get; set; }
    [MaxLength(1024)]
    public string PageUrl { get; set; } = string.Empty;
    public double TimeOnPage { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public sealed class Conversion
{
    [Key]
    public Guid ConversionId { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    public Guid SessionId { get; set; }
    public ConversionType Type { get; set; }
    public decimal? Value { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public sealed class HeatmapData
{
    [Key]
    public Guid HeatmapId { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    [MaxLength(1024)]
    public string PageUrl { get; set; } = string.Empty;
    public int X { get; set; }
    public int Y { get; set; }
    public int ScrollDepth { get; set; }
    public DeviceType DeviceType { get; set; } = DeviceType.Unknown;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public sealed class DailySnapshot
{
    [Key]
    public Guid SnapshotId { get; set; } = Guid.NewGuid();
    public Guid SiteId { get; set; }
    public DateOnly Date { get; set; }
    public int TotalVisitors { get; set; }
    public int Sessions { get; set; }
    public int PageViews { get; set; }
    public int Conversions { get; set; }
    [MaxLength(100)]
    public string TopSource { get; set; } = string.Empty;
    [MaxLength(1024)]
    public string TopPage { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class AppUser
{
    [Key]
    public Guid UserId { get; set; } = Guid.NewGuid();
    [MaxLength(120)]
    public string Email { get; set; } = string.Empty;
    [MaxLength(120)]
    public string? DisplayName { get; set; }
    [MaxLength(200)]
    public string PasswordHash { get; set; } = string.Empty;
    [MaxLength(60)]
    public string Role { get; set; } = "Admin";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
