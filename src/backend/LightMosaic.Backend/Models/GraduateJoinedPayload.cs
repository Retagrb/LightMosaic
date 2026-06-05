namespace LightMosaic.Backend.Models;

public sealed record GraduateJoinedPayload(
    string Id,
    string Name,
    int Index,
    long Timestamp,
    JoinSource Source);
