namespace LightMosaic.Backend.Models;

public sealed class GraduateRecord
{
    public required string Id { get; init; }
    public required string Name { get; init; }
    public required int Index { get; init; }
    public required long Timestamp { get; init; }
    public required JoinSource Source { get; init; }
}
