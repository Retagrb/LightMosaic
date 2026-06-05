using LightMosaic.Backend.Hubs;
using LightMosaic.Backend.Models;
using LightMosaic.Backend.Options;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Options;

namespace LightMosaic.Backend.Services;

public sealed class CeremonyService : ICeremonyService
{
    private readonly object _gate = new();
    private readonly CeremonyOptions _options;
    private readonly IHubContext<CeremonyHub> _hub;

    private readonly List<GraduateRecord> _graduates = [];
    private CeremonyStage _stage = CeremonyStage.Idle;
    private string _ceremonySeed = NewSeed();
    private int _version;

    public CeremonyService(IOptions<CeremonyOptions> options, IHubContext<CeremonyHub> hub)
    {
        _options = options.Value;
        _hub = hub;
    }

    public event Action<string>? CeremonyReset;

    public CeremonySnapshot GetSnapshot()
    {
        lock (_gate)
            return BuildSnapshot();
    }

    public async Task<LightUpResult> LightUpAsync(
        string name,
        JoinSource source = JoinSource.Mobile,
        CancellationToken ct = default)
    {
        if (!NameValidator.TryValidate(name, out var validName, out var error))
            return new LightUpResult(false, error, null);

        GraduateJoinedPayload payload;
        bool firstJoin;

        lock (_gate)
        {
            var record = new GraduateRecord
            {
                Id = Guid.NewGuid().ToString("N"),
                Name = validName,
                Index = _graduates.Count + 1,
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
                Source = source,
            };
            _graduates.Add(record);

            firstJoin = _graduates.Count == 1;
            if (firstJoin && _stage == CeremonyStage.Idle)
                _stage = CeremonyStage.Collecting;

            payload = ToPayload(record);
            BumpVersion();
        }

        await _hub.Clients.Group(CeremonyHub.DisplayGroup).SendAsync("graduateJoined", payload, ct);

        if (firstJoin)
            await BroadcastStageChangedAsync(ct);

        return new LightUpResult(true, null, payload);
    }

    public async Task ResetAsync(CancellationToken ct = default)
    {
        string ceremonySeed;
        lock (_gate)
        {
            ResetState();
            BumpVersion();
            ceremonySeed = _ceremonySeed;
        }

        NotifyCeremonyReset(ceremonySeed);
        await BroadcastStageChangedAsync(ct);
        await _hub.Clients.Group(CeremonyHub.DisplayGroup).SendAsync("reset", cancellationToken: ct);
    }

    public async Task ClearGraduatesAsync(CancellationToken ct = default)
    {
        lock (_gate)
        {
            _graduates.Clear();
            if (_stage is not CeremonyStage.Idle)
                _stage = CeremonyStage.Idle;
            BumpVersion();
        }

        await BroadcastStageChangedAsync(ct);
        await _hub.Clients.Group(CeremonyHub.DisplayGroup).SendAsync("graduatesCleared", cancellationToken: ct);
    }

    public async Task ForceCompleteAsync(CancellationToken ct = default)
    {
        await EnterFinalAsync(ct);
        await _hub.Clients.Group(CeremonyHub.DisplayGroup).SendAsync("forceComplete", cancellationToken: ct);
    }

    public async Task EnterFinalAsync(CancellationToken ct = default)
    {
        bool changed;
        lock (_gate)
        {
            if (_stage is CeremonyStage.FinalTransform or CeremonyStage.Completed)
                return;
            _stage = CeremonyStage.FinalTransform;
            BumpVersion();
            changed = true;
        }

        if (!changed)
            return;

        await BroadcastStageChangedAsync(ct);
        await _hub.Clients.Group(CeremonyHub.DisplayGroup).SendAsync("enterFinal", cancellationToken: ct);
    }

    public async Task<(bool Success, string? Error)> SetJoinUrlAsync(string joinUrl, CancellationToken ct = default)
    {
        if (!TryNormalizeJoinUrl(joinUrl, out var normalized, out var error))
            return (false, error);

        lock (_gate)
        {
            if (JoinUrl() == normalized)
                return (true, null);

            _options.JoinUrl = normalized;
            BumpVersion();
        }

        await _hub.Clients.Group(CeremonyHub.DisplayGroup).SendAsync(
            "joinUrlChanged",
            new { joinUrl = normalized },
            ct);

        return (true, null);
    }

    public async Task NotifyFinalTransformFinishedAsync(CancellationToken ct = default)
    {
        lock (_gate)
        {
            if (_stage != CeremonyStage.FinalTransform)
                return;
            _stage = CeremonyStage.Completed;
            BumpVersion();
        }

        await BroadcastStageChangedAsync(ct);
    }

    private void ResetState()
    {
        _graduates.Clear();
        _stage = CeremonyStage.Idle;
        _ceremonySeed = NewSeed();
    }

    private CeremonySnapshot BuildSnapshot() =>
        new(
            _stage,
            _graduates.Count,
            JoinUrl(),
            _ceremonySeed,
            _version,
            _graduates.TakeLast(_options.RecentGraduatesLimit).Select(ToPayload).ToList());

    private string JoinUrl()
    {
        if (!string.IsNullOrWhiteSpace(_options.JoinUrl))
            return _options.JoinUrl.Trim();

        return $"{_options.PublicBaseUrl.TrimEnd('/')}/mobile";
    }

    private static bool TryNormalizeJoinUrl(string raw, out string normalized, out string? error)
    {
        normalized = string.Empty;
        error = null;

        var url = raw.Trim();
        if (string.IsNullOrEmpty(url))
        {
            error = "Join URL is required.";
            return false;
        }

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https"))
        {
            error = "Enter a valid http or https URL.";
            return false;
        }

        normalized = uri.ToString().TrimEnd('/');
        return true;
    }

    private static GraduateJoinedPayload ToPayload(GraduateRecord r) =>
        new(r.Id, r.Name, r.Index, r.Timestamp, r.Source);

    private static string NewSeed() => Guid.NewGuid().ToString("N");

    private void BumpVersion() => _version++;

    private void NotifyCeremonyReset(string ceremonySeed)
    {
        var handlers = CeremonyReset?.GetInvocationList();
        if (handlers is null)
            return;

        foreach (var handler in handlers.Cast<Action<string>>())
        {
            try
            {
                handler(ceremonySeed);
            }
            catch
            {
                // A disconnected mobile circuit must not block the ceremony reset.
            }
        }
    }

    private async Task BroadcastStageChangedAsync(CancellationToken ct)
    {
        string stage;
        lock (_gate)
            stage = _stage.ToString();

        await _hub.Clients.Group(CeremonyHub.DisplayGroup).SendAsync(
            "stageChanged",
            new { stage },
            ct);
    }
}
