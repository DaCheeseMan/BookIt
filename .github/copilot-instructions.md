# Copilot Instructions

## Project Overview

BookIt is a multi-tenant SaaS resource booking platform. Any organisation can sign up, create a "space" (tenant), add bookable resources (sauna, court, table, boat, car, meeting room, etc.), and let their members book slots. It uses .NET Aspire to orchestrate a full-stack app: an ASP.NET Core Minimal API backend, a React/Vite/TypeScript frontend, PostgreSQL for data, and Keycloak for OIDC authentication.

## Architecture

```
BookIt.AppHost/   – Aspire orchestration host (defines all services and their wiring)
BookIt.Server/    – ASP.NET Core Minimal API (booking logic, EF Core, JWT auth)
frontend/         – React 19 + Vite + TypeScript (OIDC via Keycloak, Axios API client)
realms/           – Keycloak realm JSON (imported on startup in local dev)
```

**Service dependency chain**: Frontend → Server → PostgreSQL + Keycloak. The AppHost wires all wait-for dependencies and injects connection strings/URLs as environment variables.

**The AppHost is the single source of truth for infrastructure.** Changes to ports, service names, or resources must be made there. It uses Aspire 13 on .NET 10.

## Running Locally

All services are started via Aspire — run only the AppHost:

```bash
cd BookIt.AppHost
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
dotnet build BookIt.sln
```

**EF Core migrations** (from repo root):
```bash
dotnet ef migrations add <Name> --project BookIt.Server
dotnet ef database update --project BookIt.Server
```

## Key Conventions

### Backend (BookIt.Server)

- **Minimal APIs only** — no MVC controllers. All endpoints are registered in `Program.cs`.
- **DateOnly / TimeOnly** are used for date and time fields (not DateTime).
- **Booking duration is per-resource** — `endTime = startTime + resource.SlotDurationMinutes`, enforced server-side.
- **Multi-tenant**: every resource and booking has a `TenantId`. Tenants are identified by `slug` in URLs. Tenant owners manage their own resources.
- **Auth claims**: user ID comes from the `sub` claim; display name from `name` claim. Both extracted directly in endpoint handlers.
- **Keycloak realm name** is read from `config["Keycloak:RealmName"]` (default: `"bookit"`) — never hardcode it.
- **EF migrations run automatically on startup** (retry with back-off). Do not add explicit migration calls for production.
- **CORS** allows `localhost:5173` and `localhost:5174` (Vite dev ports).
- Namespace convention: `BookIt.Server.Models`, `BookIt.Server.Data`.

### Data Model

- **Tenant** — organisation that owns resources (Id, Name, Slug, Description, OwnerId, CreatedAt)
- **Resource** — bookable item (Id, TenantId, Name, Description, ResourceType, SlotDurationMinutes, MaxAdvanceDays, IsActive)
- **Booking** — reservation (Id, ResourceId, TenantId, UserId, user details, Date, StartTime, EndTime, CreatedAt)

### Frontend

- **Axios client** in `src/api/client.ts` — set the JWT token via `setAuthToken()` after OIDC login. All API requests go through this client.
- **OIDC config** lives in `main.tsx` (authority, client ID, redirect URIs). The Keycloak URL is `VITE_KEYCLOAK_URL` env var (defaults to `http://localhost:8080`). Realm: `bookit`, client: `bookit-web`.
- **Protected routes** use `<ProtectedRoute>` wrapper component — wrap any route that requires authentication.
- API types (`Tenant`, `Resource`, `Booking`) are defined in `src/api/client.ts` — keep them in sync with the server models.
- The Vite dev server proxies `/api` to the backend using `SERVER_HTTP` / `SERVER_HTTPS` env vars injected by Aspire.
- **All UI features must be fully responsive.** Every new page, component, or UI change must work well on both mobile (≥320px) and desktop. Use `@media (max-width: 768px)` breakpoints, flex/grid stacking, full-width buttons, and minimum 44px touch targets on coarse-pointer devices. Never add a UI feature without also making it mobile-friendly.

### Aspire AppHost

- Resources are defined in `AppHost.cs`. New services or infrastructure must be added here.
- Keycloak realm is imported from `realms/bookit-realm.json` on first run. Changes to Keycloak config (clients, roles, scopes) should be exported back to this file.
- The frontend detects Node.js from nvm, Homebrew, Volta, and fnm paths — no need to modify for standard Node installs.
- Secrets (DB passwords) use `AddParameter(secret: true)` — store values in user secrets for local dev.
- Database name: `bookitdb`. Realm name variable: `realmName = "bookit"`.

## Deployment

```bash
azd up       # Provision Azure resources + build + deploy
azd deploy   # Re-deploy without re-provisioning
```

Target: **Azure Container Apps**. The AppHost generates Bicep via Aspire's Azure provisioning. Resources created: Container Apps Environment, Azure Container Registry, Azure PostgreSQL Flexible Server (for Keycloak in production).
