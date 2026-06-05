using LightMosaic.Backend.Models;

namespace LightMosaic.Backend.Services;

public sealed class GraduateSimulatorService
{
    private readonly ICeremonyService _ceremony;
    private readonly object _gate = new();
    private CancellationTokenSource? _cts;
    private Task? _runTask;
    private bool _running;
    private int _completed;
    private int _failed;
    private int _targetCount;
    private int _planned;
    private string? _lastName;
    private string? _lastError;

    public GraduateSimulatorService(ICeremonyService ceremony) => _ceremony = ceremony;

    public event Action? StateChanged;

    public bool IsRunning
    {
        get { lock (_gate) return _running; }
    }

    public SimulatorStatus GetStatus()
    {
        lock (_gate)
        {
            return new SimulatorStatus(
                _running,
                _completed,
                _failed,
                _targetCount,
                _planned,
                _lastName,
                _lastError);
        }
    }

    public int Start(int delayMs, int expectedCount, int litCount)
    {
        delayMs = Math.Clamp(delayMs, 50, 10_000);
        expectedCount = Math.Max(1, expectedCount);
        litCount = Math.Max(0, litCount);
        var remaining = Math.Max(0, expectedCount - litCount);
        if (remaining == 0)
            return 0;

        lock (_gate)
        {
            if (_running)
                return 0;

            _cts = new CancellationTokenSource();
            _running = true;
            _completed = 0;
            _failed = 0;
            _targetCount = expectedCount;
            _planned = remaining;
            _lastName = null;
            _lastError = null;
            var names = PickNames(remaining);
            _runTask = RunAsync(names, delayMs, _cts.Token);
        }

        Notify();
        return remaining;
    }

    public void Stop()
    {
        CancellationTokenSource? cts;
        lock (_gate)
        {
            if (!_running)
                return;
            cts = _cts;
        }

        cts?.Cancel();
    }

    private static List<string> PickNames(int count)
    {
        var pool = GraduateSimulatorNames.All;
        var shuffled = pool.OrderBy(_ => Random.Shared.Next()).ToList();
        var result = new List<string>(count);
        for (var i = 0; i < count; i++)
            result.Add(shuffled[i % shuffled.Count]);
        return result;
    }

    private async Task RunAsync(IReadOnlyList<string> names, int delayMs, CancellationToken ct)
    {
        try
        {
            foreach (var name in names)
            {
                ct.ThrowIfCancellationRequested();

                var result = await _ceremony.LightUpAsync(name, JoinSource.Simulator, ct);
                lock (_gate)
                {
                    _lastName = name;
                    if (result.Success)
                        _completed++;
                    else
                    {
                        _failed++;
                        _lastError = result.Error;
                    }
                }

                Notify();
                await Task.Delay(delayMs, ct);
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // stopped by admin
        }
        finally
        {
            lock (_gate)
            {
                _running = false;
                _cts?.Dispose();
                _cts = null;
            }

            Notify();
        }
    }

    private void Notify() => StateChanged?.Invoke();
}

public sealed record SimulatorStatus(
    bool IsRunning,
    int Completed,
    int Failed,
    int TargetCount,
    int Planned,
    string? LastName,
    string? LastError);
