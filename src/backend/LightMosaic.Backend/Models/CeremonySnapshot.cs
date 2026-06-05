namespace LightMosaic.Backend.Models;

public sealed record CeremonySnapshot(
    CeremonyStage Stage,
    int LitCount,
    string JoinUrl,
    string CeremonySeed,
    int Version,
    IReadOnlyList<GraduateJoinedPayload> RecentGraduates);
