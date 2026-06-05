using LightMosaic.Backend.Models;

namespace LightMosaic.Backend.Services;

public interface ICeremonyService
{
    event Action<string>? CeremonyReset;

    CeremonySnapshot GetSnapshot();
    Task<LightUpResult> LightUpAsync(string name, JoinSource source = JoinSource.Mobile, CancellationToken ct = default);
    Task ResetAsync(CancellationToken ct = default);
    Task ClearGraduatesAsync(CancellationToken ct = default);
    Task ForceCompleteAsync(CancellationToken ct = default);
    Task EnterFinalAsync(CancellationToken ct = default);
    Task<(bool Success, string? Error)> SetJoinUrlAsync(string joinUrl, CancellationToken ct = default);
    Task NotifyFinalTransformFinishedAsync(CancellationToken ct = default);
}
