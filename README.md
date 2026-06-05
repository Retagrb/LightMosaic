# LightMosaic

Interactive graduation ceremony display: graduates join from their phones, each name flies onto the big screen as a comet, and lights assemble into a mask-shaped mosaic in real time.

## Stack

| Part | Tech |
|------|------|
| Server & join UI | ASP.NET Core (Blazor Server, MudBlazor), SignalR |
| Venue display | TypeScript, Vite, Pixi.js |

## Prerequisites

- [.NET SDK 10](https://dotnet.microsoft.com/download)
- [Node.js](https://nodejs.org/) (LTS) for the display frontend

## Quick start

```bash
# 1. Build the display (output → backend wwwroot)
cd src/frontend
npm install
npm run build

# 2. Run the server
cd ../backend/LightMosaic.Backend
dotnet run
```

Open **http://localhost:5190/home** for links to all surfaces.

### Development

- **Display hot reload:** `npm run dev` in `src/frontend` (proxies SignalR to port 5190).
- **Backend:** `dotnet run` in `src/backend/LightMosaic.Backend`.

## Surfaces

| URL | Purpose |
|-----|---------|
| `/display` | Full-screen particle show (projector / LED wall) |
| `/mobile` | Graduates enter a name to “light up” |
| `/admin` | Ceremony control, simulator, reset (password in config) |
| `/home` | Entry hub |

SignalR hub: `/hubs/ceremony`.

## Configuration

- **Server:** `src/backend/LightMosaic.Backend/appsettings.json` — `Ceremony:PublicBaseUrl`, `AdminPassword`, etc.
- **Display timing & masks:** `src/frontend/src/config/displayConfig.ts` — expected headcount, mask images under `wwwroot/display/masks/`, animation tuning.

Change the admin password before any public deployment.

## Project layout

```
src/
  backend/LightMosaic.Backend/   # API, Blazor pages, SignalR, static wwwroot
  frontend/                      # Pixi display (builds into wwwroot/display)
```

Built display assets under `wwwroot/display/` are gitignored; run `npm run build` after cloning or when changing the frontend.
