using System.Text.Json;
using System.Text.Json.Serialization;
using LightMosaic.Backend.Components;
using LightMosaic.Backend.Hubs;
using LightMosaic.Backend.Options;
using LightMosaic.Backend.Services;
using MudBlazor.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<CeremonyOptions>(builder.Configuration.GetSection("Ceremony"));
builder.Services.AddSingleton<ICeremonyService, CeremonyService>();
builder.Services.AddSingleton<AdminSessionService>();
builder.Services.AddSingleton<GraduateSimulatorService>();
builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.PayloadSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });
builder.Services.AddMudServices();
builder.Services.AddRazorComponents()
    .AddInteractiveServerComponents();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error", createScopeForErrors: true);
    app.UseHsts();
}

app.UseStatusCodePagesWithReExecute("/not-found", createScopeForStatusCodePages: true);
app.UseHttpsRedirection();
app.UseAntiforgery();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapHub<CeremonyHub>("/hubs/ceremony");
app.MapGet("/display", () => Results.Redirect("/display/index.html"));

app.MapRazorComponents<App>()
    .AddInteractiveServerRenderMode();

app.Run();
