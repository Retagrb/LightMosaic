namespace LightMosaic.Backend.Models;

public sealed record LightUpResult(bool Success, string? Error, GraduateJoinedPayload? Payload);
