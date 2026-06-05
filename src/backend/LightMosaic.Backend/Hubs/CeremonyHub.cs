using LightMosaic.Backend.Services;
using Microsoft.AspNetCore.SignalR;

namespace LightMosaic.Backend.Hubs;

public sealed class CeremonyHub(ICeremonyService ceremony) : Hub
{
    public const string DisplayGroup = "display";

    public override async Task OnConnectedAsync()
    {
        if (IsDisplayClient())
            await Groups.AddToGroupAsync(Context.ConnectionId, DisplayGroup);
        await base.OnConnectedAsync();
    }

    public Task<Models.CeremonySnapshot> RequestSync()
    {
        if (!IsDisplayClient())
            throw new HubException("RequestSync is only available for display clients.");
        return Task.FromResult(ceremony.GetSnapshot());
    }

    public Task EnterFinal() =>
        ceremony.EnterFinalAsync(Context.ConnectionAborted);

    public Task NotifyFinalTransformFinished() =>
        ceremony.NotifyFinalTransformFinishedAsync(Context.ConnectionAborted);

    private bool IsDisplayClient() =>
        Context.GetHttpContext()?.Request.Query.ContainsKey("display") == true;
}
