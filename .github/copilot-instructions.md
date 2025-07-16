# Copilot Instructions for BlazorWebAppOidc.Client

## Project Overview

- **Type:** Blazor WebAssembly Client
- **Languages:** C#, JavaScript
- **Framework:** .NET 9, Blazor
- **Authentication:** OIDC (OpenID Connect)
- **Main Features:** Home, Weather, User Claims, Login/Logout

## Directory Structure

- `/Layout/` — Contains layout components (`MainLayout.razor`, `NavMenu.razor`, etc.)
- `/Pages/` — Main application pages (`Home.razor`, `Weather.razor`, `UserClaims.razor`)
- `/Weather/` — Weather feature logic and models
- `/wwwroot/` — Static assets and configuration files
- `/bin/`, `/obj/` — Build output and intermediate files

## Coding Guidelines

- Use C# for Blazor components and business logic.
- Use Razor syntax for UI components.
- Place shared layouts in `/Layout/`.
- Place page components in `/Pages/`.
- Use dependency injection for services (e.g., weather forecaster).
- Follow .NET and Blazor best practices for component structure and naming.

## Copilot Usage

- Generate Blazor components using `.razor` files.
- Scaffold C# classes for services and models.
- Write unit tests for C# logic.
- Suggest improvements for Razor markup and CSS.
- Avoid generating code for `/bin/` and `/obj/` directories.
- Reference static assets from `/wwwroot/`.

## Example Tasks

- Create a new page in `/Pages/`.
- Add a new service in the folder for the feature the service belong to.
- Update navigation in `/Layout/NavMenu.razor`.

## Additional Notes

- Use OIDC authentication components for login/logout.
- Ensure navigation links match page routes.
- Use CSS files alongside Razor components for styling.
