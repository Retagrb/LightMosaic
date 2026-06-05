namespace LightMosaic.Backend.Options;

public sealed class CeremonyOptions
{
    public string PublicBaseUrl { get; set; } = "http://localhost:5190";

    /// <summary>Full mobile join URL for the display QR. Empty = {PublicBaseUrl}/mobile.</summary>
    public string? JoinUrl { get; set; }

    public int RecentGraduatesLimit { get; set; } = 120;
    public string AdminPassword { get; set; } = "lightmosaic";
}
