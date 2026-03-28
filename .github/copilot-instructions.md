# Copilot Instructions

## Project Overview

JtK (Jonsereds Tennisklubb) is a tennis court booking application for a Swedish tennis club. It uses .NET Aspire to orchestrate a full-stack app: an ASP.NET Core Minimal API backend, a React/Vite/TypeScript frontend, PostgreSQL for data, and Keycloak for OIDC authentication.

## Architecture

```
JtK.AppHost/   – Aspire orchestration host (defines all services and their wiring)
JtK.Server/    – ASP.NET Core Minimal API (booking logic, EF Core, JWT auth)
frontend/      – React 19 + Vite + TypeScript (OIDC via Keycloak, Axios API client)
realms/        – Keycloak realm JSON (imported on startup in local dev)
```

**Service dependency chain**: Frontend → Server → PostgreSQL + Keycloak. The AppHost wires all wait-for dependencies and injects connection strings/URLs as environment variables.

**The AppHost is the single source of truth for infrastructure.** Changes to ports, service names, or resources must be made there. It uses Aspire 9 on .NET 10.

## Running Locally

All services are started via Aspire — run only the AppHost:

```bash
cd JtK.AppHost
dotnet run
```

This starts Keycloak (Docker, port 8080), PostgreSQL (Docker), the API, and the frontend dev server. The Aspire dashboard URL is printed on startup.

For frontend-only iteration:

```bash
cd frontend
npm run dev
```

## Build & Lint Commands

**Frontend:**
```bash
cd frontend
npm run build      # tsc -b && vite build
npm run lint       # ESLint
```

**Backend:**
```bash
dotnet build JtK.sln
```

**EF Core migrations** (from repo root):
```bash
dotnet ef migrations add <Name> --project JtK.Server
dotnet ef database update --project JtK.Server
```

## Key Conventions

### Backend (JtK.Server)

- **Minimal APIs only** — no MVC controllers. All endpoints are registered in `Program.cs`.
- **DateOnly / TimeOnly** are used for date and time fields (not DateTime).
- **Bookings are always 1 hour** — `endTime` is always `startTime + 1h`, enforced server-side.
- **Auth claims**: user ID comes from the `sub` claim; display name from `name` claim. Both extracted directly in endpoint handlers.
- **EF migrations run automatically on startup** in development (`app.ApplyMigrations()` in Program.cs). Do not add explicit migration calls for production.
- **CORS** allows `localhost:5173` and `localhost:5174` (Vite dev ports).
- Namespace convention: `JtK.Server.Models`, `JtK.Server.Data`.

### Frontend

- **Axios client** in `src/api/client.ts` — set the JWT token via `setAuthToken()` after OIDC login. All API requests go through this client.
- **OIDC config** lives in `main.tsx` (authority, client ID, redirect URIs). The Keycloak URL is `VITE_KEYCLOAK_URL` env var (defaults to `http://localhost:8080`).
- **Protected routes** use `<ProtectedRoute>` wrapper component — wrap any route that requires authentication.
- API types (`Court`, `Booking`) are defined in `src/api/client.ts` — keep them in sync with the server models.
- The Vite dev server proxies `/api` to the backend using `SERVER_HTTP` / `SERVER_HTTPS` env vars injected by Aspire.
- **All UI features must be fully responsive.** Every new page, component, or UI change must work well on both mobile (≥320px) and desktop. Use `@media (max-width: 768px)` breakpoints, flex/grid stacking, full-width buttons, and minimum 44px touch targets on coarse-pointer devices. Never add a UI feature without also making it mobile-friendly.

### Aspire AppHost

- Resources are defined in `AppHost.cs`. New services or infrastructure must be added here.
- Keycloak realm is imported from `realms/jtk-realm.json` on first run. Changes to Keycloak config (clients, roles, scopes) should be exported back to this file.
- The frontend detects Node.js from nvm, Homebrew, Volta, and fnm paths — no need to modify for standard Node installs.
- Secrets (DB passwords) use `AddParameter(secret: true)` — store values in user secrets for local dev.

## Deployment

```bash
azd up       # Provision Azure resources + build + deploy
azd deploy   # Re-deploy without re-provisioning
```

Target: **Azure Container Apps**. The AppHost generates Bicep via Aspire's Azure provisioning. Resources created: Container Apps Environment, Azure Container Registry, Azure PostgreSQL Flexible Server (for Keycloak in production).
