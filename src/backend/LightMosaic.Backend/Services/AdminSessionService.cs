using System.Collections.Concurrent;
using LightMosaic.Backend.Options;
using Microsoft.Extensions.Options;

namespace LightMosaic.Backend.Services;

public sealed class AdminSessionService(IOptions<CeremonyOptions> options)
{
    private readonly ConcurrentDictionary<string, byte> _sessions = new();
    private readonly string _password = options.Value.AdminPassword;

    public bool TryLogin(string password, out string token)
    {
        token = string.Empty;
        if (!string.Equals(password, _password, StringComparison.Ordinal))
            return false;

        token = Guid.NewGuid().ToString("N");
        _sessions[token] = 0;
        return true;
    }

    public bool IsValid(string? token) =>
        !string.IsNullOrEmpty(token) && _sessions.ContainsKey(token);

    public void Logout(string? token)
    {
        if (!string.IsNullOrEmpty(token))
            _sessions.TryRemove(token, out _);
    }
}
