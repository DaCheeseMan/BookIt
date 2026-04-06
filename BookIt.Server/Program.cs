using BookIt.Server.Data;
using BookIt.Server.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();

var realmName = builder.Configuration["Keycloak:RealmName"] ?? "bookit";
var clientId = builder.Configuration["Keycloak:ClientId"] ?? "bookit-web";

builder.AddNpgsqlDbContext<AppDbContext>("bookitdb");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Keycloak:Authority"];
        options.Audience = clientId;
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters.ValidateIssuer = false;
        options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
        {
            OnAuthenticationFailed = ctx =>
            {
                ctx.HttpContext.RequestServices
                    .GetRequiredService<ILogger<Program>>()
                    .LogError(ctx.Exception,
                        "JWT authentication failed. Authority={Authority}",
                        options.Authority);
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    o.SerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://localhost:5174",
                "https://localhost:5173",
                "https://localhost:5174")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddHttpClient("keycloak-account");

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var migrationLogger = scope.ServiceProvider.GetRequiredService<ILogger<AppDbContext>>();
    const int maxAttempts = 8;
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            await db.Database.MigrateAsync();
            break;
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1));
            migrationLogger.LogWarning(ex,
                "Migration attempt {Attempt}/{Max} failed. Retrying in {Delay}s...",
                attempt, maxAttempts, delay.TotalSeconds);
            await Task.Delay(delay);
        }
    }
}

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// Role helpers
static bool IsAdmin(ClaimsPrincipal user)
{
    var raw = user.FindFirstValue("realm_access");
    if (raw is null) return false;
    try
    {
        var doc = System.Text.Json.JsonDocument.Parse(raw);
        if (doc.RootElement.TryGetProperty("roles", out var roles))
            return roles.EnumerateArray().Any(r => r.GetString() == "admin");
    }
    catch { }
    return false;
}

static bool IsSpaceAdmin(ClaimsPrincipal user)
{
    var raw = user.FindFirstValue("realm_access");
    if (raw is null) return false;
    try
    {
        var doc = System.Text.Json.JsonDocument.Parse(raw);
        if (doc.RootElement.TryGetProperty("roles", out var roles))
            return roles.EnumerateArray().Any(r => r.GetString() is "tenant-admin" or "admin");
    }
    catch { }
    return false;
}

// --- Config endpoint ---
app.MapGet("/api/config", (IConfiguration config, IWebHostEnvironment env) =>
{
    var authority = config["Keycloak:ExternalAuthority"] ?? config["Keycloak:Authority"] ?? "";
    if (!env.IsDevelopment())
        authority = authority.Replace("http://", "https://");
    return Results.Ok(new { keycloakAuthority = authority });
});

// --- Spaces API ---
var spacesApi = app.MapGroup("/api/spaces");

// List all spaces (public)
spacesApi.MapGet("/", async (AppDbContext db) =>
    await db.Spaces
        .Select(t => new { t.Id, t.Name, t.Slug, t.Description, t.OwnerId, t.Visibility, t.CreatedAt })
        .ToListAsync());

// Get single space (public)
spacesApi.MapGet("/{idOrSlug}", async (string idOrSlug, AppDbContext db) =>
{
    Space? space = int.TryParse(idOrSlug, out var id)
        ? await db.Spaces.FindAsync(id)
        : await db.Spaces.FirstOrDefaultAsync(t => t.Slug == idOrSlug);
    return space is null ? Results.NotFound() : Results.Ok(new { space.Id, space.Name, space.Slug, space.Description, space.OwnerId, space.Visibility, space.CreatedAt });
});

// Create space (authenticated — caller becomes owner)
spacesApi.MapPost("/", async (CreateSpaceRequest req, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    if (user.Identity?.IsAuthenticated != true) return Results.Unauthorized();

    var ownerId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;

    // Free tier: max 1 space per user
    var existingSpaceCount = await db.Spaces.CountAsync(s => s.OwnerId == ownerId);
    if (existingSpaceCount >= 1)
        return Results.BadRequest("Free tier allows only 1 space per account.");

    if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Slug))
        return Results.BadRequest("Name and slug are required.");

    var slug = req.Slug.ToLowerInvariant().Trim();
    if (await db.Spaces.AnyAsync(t => t.Slug == slug))
        return Results.Conflict("A space with that slug already exists.");

    var visibility = SpaceVisibility.Public; // Free tier: public spaces only

    var space = new Space
    {
        Name = req.Name.Trim(),
        Slug = slug,
        Description = req.Description?.Trim() ?? string.Empty,
        OwnerId = ownerId,
        Visibility = visibility,
    };
    db.Spaces.Add(space);
    await db.SaveChangesAsync();

    // Create a Keycloak group for this space (best-effort)
    _ = Task.Run(async () =>
    {
        try { await CreateKeycloakGroupAsync(config, httpClientFactory, env.IsDevelopment(), $"spaces/{slug}"); }
        catch { /* group sync is best-effort */ }
    });

    return Results.Created($"/api/spaces/{space.Slug}", new { space.Id, space.Name, space.Slug, space.Description, space.OwnerId, space.Visibility, space.CreatedAt });
}).RequireAuthorization();

// Update space (space owner or global admin)
spacesApi.MapPut("/{id:int}", async (int id, UpdateSpaceRequest req, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FindAsync(id);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    if (space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();

    space.Name = req.Name?.Trim() ?? space.Name;
    space.Description = req.Description?.Trim() ?? space.Description;
    // Free tier: visibility input is accepted but always forced to Public
    if (req.Visibility != null)
        space.Visibility = SpaceVisibility.Public;
    await db.SaveChangesAsync();
    return Results.Ok(new { space.Id, space.Name, space.Slug, space.Description, space.Visibility });
}).RequireAuthorization();

// Delete space (space owner or global admin)
spacesApi.MapDelete("/{id:int}", async (int id, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FindAsync(id);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    if (space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();
    db.Spaces.Remove(space);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

// --- Resources API (under space) ---

// Helper: check if a user has access to a space (owner, global admin, or member of private space)
static async Task<bool> HasSpaceAccess(Space space, string userId, bool isAdmin, AppDbContext db)
{
    if (isAdmin || space.OwnerId == userId) return true;
    if (space.Visibility == SpaceVisibility.Public) return true;
    return await db.Memberships.AnyAsync(m => m.SpaceId == space.Id && m.UserId == userId);
}

// List resources for a space (access-controlled)
spacesApi.MapGet("/{spaceId:int}/resources", async (int spaceId, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    if (space.Visibility == SpaceVisibility.Private)
    {
        if (user.Identity?.IsAuthenticated != true) return Results.Forbid();
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
        if (!await HasSpaceAccess(space, userId, IsAdmin(user), db)) return Results.Forbid();
    }
    return Results.Ok(await db.Resources
        .Where(r => r.SpaceId == spaceId && r.IsActive)
        .Select(r => new { r.Id, r.SpaceId, r.Name, r.Description, r.ResourceType, r.SlotDurationMinutes, r.MaxAdvanceDays, r.IsActive })
        .ToListAsync());
});

// Get single resource (access-controlled)
spacesApi.MapGet("/{spaceId:int}/resources/{resourceId:int}", async (int spaceId, int resourceId, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    if (space.Visibility == SpaceVisibility.Private)
    {
        if (user.Identity?.IsAuthenticated != true) return Results.Forbid();
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
        if (!await HasSpaceAccess(space, userId, IsAdmin(user), db)) return Results.Forbid();
    }
    var resource = await db.Resources.FirstOrDefaultAsync(r => r.Id == resourceId && r.SpaceId == spaceId);
    return resource is null ? Results.NotFound() : Results.Ok(new { resource.Id, resource.SpaceId, resource.Name, resource.Description, resource.ResourceType, resource.SlotDurationMinutes, resource.MaxAdvanceDays, resource.IsActive });
});

// Get bookings for a resource in a date range (access-controlled)
spacesApi.MapGet("/{spaceId:int}/resources/{resourceId:int}/bookings",
    async (int spaceId, int resourceId, DateOnly from, DateOnly to, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    var isAuthenticated = user.Identity?.IsAuthenticated == true;
    if (space.Visibility == SpaceVisibility.Private)
    {
        if (!isAuthenticated) return Results.Forbid();
        var checkUserId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
        if (!await HasSpaceAccess(space, checkUserId, IsAdmin(user), db)) return Results.Forbid();
    }
    var bookings = await db.Bookings
        .Where(b => b.ResourceId == resourceId && b.SpaceId == spaceId && b.Date >= from && b.Date <= to)
        .OrderBy(b => b.Date).ThenBy(b => b.StartTime)
        .Select(b => new
        {
            b.Id,
            b.Date,
            b.StartTime,
            b.EndTime,
            UserId = isAuthenticated ? b.UserId : string.Empty,
            UserName = isAuthenticated ? b.UserName : string.Empty,
            UserFirstName = isAuthenticated ? b.UserFirstName : string.Empty,
            UserLastName = isAuthenticated ? b.UserLastName : string.Empty,
            UserPhone = isAuthenticated ? b.UserPhone : string.Empty,
        })
        .ToListAsync();
    return Results.Ok(bookings);
});

// Create resource (space owner or global admin)
spacesApi.MapPost("/{spaceId:int}/resources", async (int spaceId, CreateResourceRequest req, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    if (space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();

    // Free tier: max 3 resources per space
    var resourceCount = await db.Resources.CountAsync(r => r.SpaceId == spaceId && r.IsActive);
    if (resourceCount >= 3)
        return Results.BadRequest("Free tier allows up to 3 resources per space.");

    var resource = new Resource
    {
        SpaceId = spaceId,
        Name = req.Name.Trim(),
        Description = req.Description?.Trim() ?? string.Empty,
        ResourceType = req.ResourceType.Trim(),
        SlotDurationMinutes = req.SlotDurationMinutes > 0 ? req.SlotDurationMinutes : 60,
        MaxAdvanceDays = req.MaxAdvanceDays > 0 ? req.MaxAdvanceDays : 30,
        IsActive = true,
    };
    db.Resources.Add(resource);
    await db.SaveChangesAsync();
    return Results.Created($"/api/spaces/{spaceId}/resources/{resource.Id}",
        new { resource.Id, resource.SpaceId, resource.Name, resource.Description, resource.ResourceType, resource.SlotDurationMinutes, resource.MaxAdvanceDays, resource.IsActive });
}).RequireAuthorization();

// Update resource (space owner or global admin)
spacesApi.MapPut("/{spaceId:int}/resources/{resourceId:int}", async (int spaceId, int resourceId, UpdateResourceRequest req, ClaimsPrincipal user, AppDbContext db) =>
{
    var resource = await db.Resources.Include(r => r.Space).FirstOrDefaultAsync(r => r.Id == resourceId && r.SpaceId == spaceId);
    if (resource is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    if (resource.Space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();

    resource.Name = req.Name?.Trim() ?? resource.Name;
    resource.Description = req.Description?.Trim() ?? resource.Description;
    resource.ResourceType = req.ResourceType?.Trim() ?? resource.ResourceType;
    if (req.SlotDurationMinutes > 0) resource.SlotDurationMinutes = req.SlotDurationMinutes;
    if (req.MaxAdvanceDays > 0) resource.MaxAdvanceDays = req.MaxAdvanceDays;
    if (req.IsActive.HasValue) resource.IsActive = req.IsActive.Value;
    await db.SaveChangesAsync();
    return Results.Ok(new { resource.Id, resource.SpaceId, resource.Name, resource.Description, resource.ResourceType, resource.SlotDurationMinutes, resource.MaxAdvanceDays, resource.IsActive });
}).RequireAuthorization();

// Delete resource (space owner or global admin)
spacesApi.MapDelete("/{spaceId:int}/resources/{resourceId:int}", async (int spaceId, int resourceId, ClaimsPrincipal user, AppDbContext db) =>
{
    var resource = await db.Resources.Include(r => r.Space).FirstOrDefaultAsync(r => r.Id == resourceId && r.SpaceId == spaceId);
    if (resource is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    if (resource.Space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();
    db.Resources.Remove(resource);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

// --- Membership API ---

// Get members of a space (owner, global admin, or admin member)
spacesApi.MapGet("/{spaceId:int}/members", async (int spaceId, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (space.OwnerId != userId && !IsAdmin(user))
    {
        var callerMembership = await db.Memberships.FirstOrDefaultAsync(m => m.SpaceId == spaceId && m.UserId == userId);
        if (callerMembership?.Role != SpaceMemberRole.Admin) return Results.Forbid();
    }
    var memberships = await db.Memberships.Where(m => m.SpaceId == spaceId).ToListAsync();

    // Enrich with Keycloak user info (best-effort)
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var enriched = await Task.WhenAll(memberships.Select(async m =>
    {
        string? firstName = null, lastName = null, email = null;
        if (adminToken is not null)
        {
            try
            {
                var req = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users/{m.UserId}");
                req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
                var res = await client.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var kcUser = await res.Content.ReadFromJsonAsync<KeycloakUserRepresentation>();
                    firstName = kcUser?.FirstName;
                    lastName = kcUser?.LastName;
                    email = kcUser?.Email;
                }
            }
            catch { }
        }
        return new { m.UserId, m.Role, m.JoinedAt, firstName, lastName, email };
    }));
    return Results.Ok(enriched);
}).RequireAuthorization();

// Search for a Keycloak user by email (check before adding as member)
spacesApi.MapGet("/{spaceId:int}/members/search", async (int spaceId, string email, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();

    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);
    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var searchReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users?email={Uri.EscapeDataString(email)}&exact=true");
    searchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var searchRes = await client.SendAsync(searchReq);
    if (!searchRes.IsSuccessStatusCode) return Results.StatusCode((int)searchRes.StatusCode);
    var users = await searchRes.Content.ReadFromJsonAsync<List<KeycloakUserRepresentation>>();
    var found = users?.FirstOrDefault();
    if (found is null) return Results.NotFound();
    return Results.Ok(new { found.Id, found.FirstName, found.LastName, found.Email });
}).RequireAuthorization();

// Add a member to a space (owner or global admin)
spacesApi.MapPost("/{spaceId:int}/members", async (int spaceId, AddMemberRequest req, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();

    // Find user by email in Keycloak if userId not provided
    var targetUserId = req.UserId;
    if (string.IsNullOrWhiteSpace(targetUserId) && !string.IsNullOrWhiteSpace(req.Email))
    {
        var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
        if (adminToken is null) return Results.StatusCode(502);
        var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
        var realm = config["Keycloak:RealmName"] ?? "bookit";
        var client = httpClientFactory.CreateClient("keycloak-account");
        var searchReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users?email={Uri.EscapeDataString(req.Email)}&exact=true");
        searchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var searchRes = await client.SendAsync(searchReq);
        if (!searchRes.IsSuccessStatusCode) return Results.StatusCode((int)searchRes.StatusCode);
        var users = await searchRes.Content.ReadFromJsonAsync<List<KeycloakUserRepresentation>>();
        targetUserId = users?.FirstOrDefault()?.Id;

        if (string.IsNullOrWhiteSpace(targetUserId))
        {
            // User not found — create in Keycloak if requested
            if (!req.Create || string.IsNullOrWhiteSpace(req.FirstName) || string.IsNullOrWhiteSpace(req.LastName))
                return Results.NotFound("No user found with that email address.");

            var newUser = new KeycloakUserRepresentation
            {
                Username = req.Email, Email = req.Email,
                FirstName = req.FirstName.Trim(), LastName = req.LastName.Trim(),
                Enabled = true,
            };
            var createReq = new HttpRequestMessage(HttpMethod.Post, $"{adminUrl}/admin/realms/{realm}/users");
            createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            createReq.Content = JsonContent.Create(newUser);
            var createRes = await client.SendAsync(createReq);
            if (!createRes.IsSuccessStatusCode)
                return Results.Problem("Could not create user in Keycloak.", statusCode: (int)createRes.StatusCode);

            targetUserId = createRes.Headers.Location?.Segments.Last();
            if (string.IsNullOrWhiteSpace(targetUserId)) return Results.StatusCode(500);

            // Send invite email so the new user can set their password
            var actionsReq = new HttpRequestMessage(HttpMethod.Put, $"{adminUrl}/admin/realms/{realm}/users/{targetUserId}/execute-actions-email");
            actionsReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            actionsReq.Content = JsonContent.Create(new[] { "VERIFY_EMAIL", "UPDATE_PASSWORD" });
            await client.SendAsync(actionsReq);
        }
    }

    if (string.IsNullOrWhiteSpace(targetUserId))
        return Results.BadRequest("Either userId or email is required.");

    // Don't add the owner as a member
    if (targetUserId == space.OwnerId)
        return Results.BadRequest("The space owner cannot be added as a member.");

    var existing = await db.Memberships.FirstOrDefaultAsync(m => m.SpaceId == spaceId && m.UserId == targetUserId);
    if (existing is not null)
        return Results.Conflict("User is already a member of this space.");

    var role = req.Role == "Admin" ? SpaceMemberRole.Admin : SpaceMemberRole.Member;
    var membership = new Membership { SpaceId = spaceId, UserId = targetUserId, Role = role };
    db.Memberships.Add(membership);
    await db.SaveChangesAsync();

    // Sync to Keycloak group (best-effort)
    _ = Task.Run(async () =>
    {
        try { await AddUserToKeycloakGroupAsync(config, httpClientFactory, env.IsDevelopment(), targetUserId, $"spaces/{space.Slug}"); }
        catch { }
    });

    return Results.Created($"/api/spaces/{spaceId}/members/{targetUserId}", new { membership.UserId, membership.Role, membership.JoinedAt });
}).RequireAuthorization();

// Remove a member from a space (owner, global admin, or the member themselves)
spacesApi.MapDelete("/{spaceId:int}/members/{targetUserId}", async (int spaceId, string targetUserId, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (userId != targetUserId && space.OwnerId != userId && !IsAdmin(user)) return Results.Forbid();

    var membership = await db.Memberships.FirstOrDefaultAsync(m => m.SpaceId == spaceId && m.UserId == targetUserId);
    if (membership is null) return Results.NotFound();

    db.Memberships.Remove(membership);
    await db.SaveChangesAsync();

    // Sync to Keycloak group (best-effort)
    _ = Task.Run(async () =>
    {
        try { await RemoveUserFromKeycloakGroupAsync(config, httpClientFactory, env.IsDevelopment(), targetUserId, $"spaces/{space.Slug}"); }
        catch { }
    });

    return Results.NoContent();
}).RequireAuthorization();

// Join a public space (self-service)
spacesApi.MapPost("/{spaceId:int}/join", async (int spaceId, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    if (space.Visibility == SpaceVisibility.Private) return Results.Forbid();

    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (space.OwnerId == userId) return Results.BadRequest("You are already the owner of this space.");

    var existing = await db.Memberships.AnyAsync(m => m.SpaceId == spaceId && m.UserId == userId);
    if (existing) return Results.Conflict("You are already a member of this space.");

    var membership = new Membership { SpaceId = spaceId, UserId = userId, Role = SpaceMemberRole.Member };
    db.Memberships.Add(membership);
    await db.SaveChangesAsync();

    _ = Task.Run(async () =>
    {
        try { await AddUserToKeycloakGroupAsync(config, httpClientFactory, env.IsDevelopment(), userId, $"spaces/{space.Slug}"); }
        catch { }
    });

    return Results.Created($"/api/spaces/{spaceId}/members/{userId}", new { membership.UserId, membership.Role, membership.JoinedAt });
}).RequireAuthorization();

// Leave a space (self-service)
spacesApi.MapDelete("/{spaceId:int}/leave", async (int spaceId, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var space = await db.Spaces.FindAsync(spaceId);
    if (space is null) return Results.NotFound();
    if (space.Visibility == SpaceVisibility.Public) return Results.BadRequest("Public spaces are open to everyone — there is no membership to leave.");
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (space.OwnerId == userId) return Results.BadRequest("Owners cannot leave their own space. Transfer ownership or delete it.");

    var membership = await db.Memberships.FirstOrDefaultAsync(m => m.SpaceId == spaceId && m.UserId == userId);
    if (membership is null) return Results.NotFound("You are not a member of this space.");

    db.Memberships.Remove(membership);
    await db.SaveChangesAsync();

    _ = Task.Run(async () =>
    {
        try { await RemoveUserFromKeycloakGroupAsync(config, httpClientFactory, env.IsDevelopment(), userId, $"spaces/{space.Slug}"); }
        catch { }
    });

    return Results.NoContent();
}).RequireAuthorization();

// --- Invitations API ---
// Create invite(s) for a space (owner or admin member)
spacesApi.MapPost("/{slug}/invitations", async (string slug, CreateInvitationsRequest req, ClaimsPrincipal user, AppDbContext db) =>
{
    // Free tier: invitations are not available; public spaces are open to all users
    return Results.Problem(
        title: "Not available",
        detail: "Invitations are not available on the free tier. Public spaces are open to all users.",
        statusCode: 403);
}).RequireAuthorization();

// List invitations for a space (owner or admin member)
spacesApi.MapGet("/{slug}/invitations", async (string slug, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FirstOrDefaultAsync(t => t.Slug == slug);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (space.OwnerId != userId && !IsAdmin(user))
    {
        var callerMembership = await db.Memberships.FirstOrDefaultAsync(m => m.SpaceId == space.Id && m.UserId == userId);
        if (callerMembership?.Role != SpaceMemberRole.Admin) return Results.Forbid();
    }

    // Auto-expire invitations that are past their ExpiresAt
    var now = DateTimeOffset.UtcNow;
    var expired = await db.Invitations.Where(i => i.SpaceId == space.Id && i.Status == InvitationStatus.Pending && i.ExpiresAt <= now).ToListAsync();
    foreach (var e in expired) e.Status = InvitationStatus.Expired;
    if (expired.Count > 0) await db.SaveChangesAsync();

    var invitations = await db.Invitations
        .Where(i => i.SpaceId == space.Id)
        .OrderByDescending(i => i.CreatedAt)
        .Select(i => new { i.Id, i.Email, i.Role, i.Token, i.Status, i.CreatedAt, i.ExpiresAt, i.AcceptedAt, i.AcceptedByUserId })
        .ToListAsync();
    return Results.Ok(invitations);
}).RequireAuthorization();

// Revoke an invitation (owner or admin member)
spacesApi.MapDelete("/{slug}/invitations/{invitationId:guid}", async (string slug, Guid invitationId, ClaimsPrincipal user, AppDbContext db) =>
{
    var space = await db.Spaces.FirstOrDefaultAsync(t => t.Slug == slug);
    if (space is null) return Results.NotFound();
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();
    if (space.OwnerId != userId && !IsAdmin(user))
    {
        var callerMembership = await db.Memberships.FirstOrDefaultAsync(m => m.SpaceId == space.Id && m.UserId == userId);
        if (callerMembership?.Role != SpaceMemberRole.Admin) return Results.Forbid();
    }

    var invitation = await db.Invitations.FirstOrDefaultAsync(i => i.Id == invitationId && i.SpaceId == space.Id);
    if (invitation is null) return Results.NotFound();
    if (invitation.Status != InvitationStatus.Pending) return Results.BadRequest("Only pending invitations can be revoked.");

    invitation.Status = InvitationStatus.Revoked;
    await db.SaveChangesAsync();
    return Results.NoContent();
}).RequireAuthorization();

// --- Public Invitations API ---
var invitationsApi = app.MapGroup("/api/invitations");

// Get invite details (public — used to show space name and status before accepting)
invitationsApi.MapGet("/{token}", async (string token, AppDbContext db) =>
{
    var invitation = await db.Invitations
        .Include(i => i.Space)
        .FirstOrDefaultAsync(i => i.Token == token);
    if (invitation is null) return Results.NotFound();

    // Auto-expire
    if (invitation.Status == InvitationStatus.Pending && invitation.ExpiresAt <= DateTimeOffset.UtcNow)
    {
        invitation.Status = InvitationStatus.Expired;
        await db.SaveChangesAsync();
    }

    return Results.Ok(new {
        invitation.Id,
        invitation.Email,
        invitation.Role,
        invitation.Status,
        invitation.ExpiresAt,
        spaceName = invitation.Space.Name,
        spaceSlug = invitation.Space.Slug,
    });
});

// Accept an invitation (requires authentication)
invitationsApi.MapPost("/{token}/accept", async (string token, ClaimsPrincipal user, AppDbContext db, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();

    var invitation = await db.Invitations
        .Include(i => i.Space)
        .FirstOrDefaultAsync(i => i.Token == token);
    if (invitation is null) return Results.NotFound();

    if (invitation.Status == InvitationStatus.Pending && invitation.ExpiresAt <= DateTimeOffset.UtcNow)
    {
        invitation.Status = InvitationStatus.Expired;
        await db.SaveChangesAsync();
    }

    if (invitation.Status == InvitationStatus.Accepted)
        return Results.Conflict("This invitation has already been accepted.");
    if (invitation.Status == InvitationStatus.Revoked)
        return Results.BadRequest("This invitation has been revoked.");
    if (invitation.Status == InvitationStatus.Expired)
        return Results.BadRequest("This invitation has expired.");

    var space = invitation.Space;

    // Don't add owner as member
    if (userId == space.OwnerId)
    {
        invitation.Status = InvitationStatus.Accepted;
        invitation.AcceptedAt = DateTimeOffset.UtcNow;
        invitation.AcceptedByUserId = userId;
        await db.SaveChangesAsync();
        return Results.Ok(new { spaceName = space.Name, spaceSlug = space.Slug });
    }

    // Check if already a member
    var existing = await db.Memberships.FirstOrDefaultAsync(m => m.SpaceId == space.Id && m.UserId == userId);
    if (existing is null)
    {
        var role = invitation.Role == "Admin" ? SpaceMemberRole.Admin : SpaceMemberRole.Member;
        var membership = new Membership { SpaceId = space.Id, UserId = userId, Role = role };
        db.Memberships.Add(membership);

        _ = Task.Run(async () =>
        {
            try { await AddUserToKeycloakGroupAsync(config, httpClientFactory, env.IsDevelopment(), userId, $"spaces/{space.Slug}"); }
            catch { }
        });
    }

    invitation.Status = InvitationStatus.Accepted;
    invitation.AcceptedAt = DateTimeOffset.UtcNow;
    invitation.AcceptedByUserId = userId;
    await db.SaveChangesAsync();

    return Results.Ok(new { spaceName = space.Name, spaceSlug = space.Slug });
}).RequireAuthorization();
var bookingsApi = app.MapGroup("/api/bookings").RequireAuthorization();

// User's own bookings
bookingsApi.MapGet("/", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    return await db.Bookings
        .Include(b => b.Resource).ThenInclude(r => r.Space)
        .Where(b => b.UserId == userId)
        .OrderByDescending(b => b.Date).ThenBy(b => b.StartTime)
        .Select(b => new {
            b.Id, b.ResourceId, b.SpaceId, b.Date, b.StartTime, b.EndTime,
            b.UserId, b.UserName, b.UserFirstName, b.UserLastName, b.UserPhone,
            b.CreatedAt,
            resourceName = b.Resource.Name,
            resourceType = b.Resource.ResourceType,
            spaceName = b.Resource.Space.Name,
            spaceSlug = b.Resource.Space.Slug,
        })
        .ToListAsync();
});

// Create booking
bookingsApi.MapPost("/", async (CreateBookingRequest req, ClaimsPrincipal user, AppDbContext db) =>
{
    var resource = await db.Resources.Include(r => r.Space).FirstOrDefaultAsync(r => r.Id == req.ResourceId);
    if (resource is null || !resource.IsActive)
        return Results.BadRequest("Resource not found or inactive.");

    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
    if (userId is null) return Results.Unauthorized();

    // Private space access check
    if (resource.Space.Visibility == SpaceVisibility.Private && !IsAdmin(user) && resource.Space.OwnerId != userId)
    {
        if (!await db.Memberships.AnyAsync(m => m.SpaceId == resource.SpaceId && m.UserId == userId))
            return Results.Forbid();
    }

    var userName = user.FindFirstValue(ClaimTypes.Name) ?? user.FindFirstValue("preferred_username") ?? userId;
    var userFirstName = user.FindFirstValue(ClaimTypes.GivenName) ?? user.FindFirstValue("given_name") ?? string.Empty;
    var userLastName = user.FindFirstValue(ClaimTypes.Surname) ?? user.FindFirstValue("family_name") ?? string.Empty;
    var userPhone = user.FindFirstValue("phone_number") ?? string.Empty;

    var start = req.StartTime;
    var end = start.AddMinutes(resource.SlotDurationMinutes);

    if (end <= start) // AddMinutes wraps past midnight
        return Results.BadRequest("Booking slot would extend past midnight.");

    var nowUtc = DateTime.UtcNow;
    var today = DateOnly.FromDateTime(nowUtc);
    var nowTime = TimeOnly.FromDateTime(nowUtc);
    if (req.Date < today || (req.Date == today && start <= nowTime))
        return Results.BadRequest("Cannot book a slot in the past.");

    if (req.Date > today.AddDays(resource.MaxAdvanceDays))
        return Results.BadRequest($"Cannot book more than {resource.MaxAdvanceDays} days in advance.");

    var overlap = await db.Bookings.AnyAsync(b =>
        b.ResourceId == req.ResourceId &&
        b.Date == req.Date &&
        b.StartTime < end && b.EndTime > start);

    if (overlap)
        return Results.Conflict("That slot is already booked.");

    var booking = new Booking
    {
        ResourceId = req.ResourceId,
        SpaceId = resource.SpaceId,
        UserId = userId,
        UserName = userName,
        UserFirstName = userFirstName,
        UserLastName = userLastName,
        UserPhone = userPhone,
        Date = req.Date,
        StartTime = start,
        EndTime = end,
    };
    db.Bookings.Add(booking);
    await db.SaveChangesAsync();
    return Results.Created($"/api/bookings/{booking.Id}", booking);
});

// Cancel booking (owner or global admin or space owner)
bookingsApi.MapDelete("/{id:int}", async (int id, ClaimsPrincipal user, AppDbContext db) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    var booking = await db.Bookings.Include(b => b.Resource).ThenInclude(r => r.Space).FirstOrDefaultAsync(b => b.Id == id);
    if (booking is null) return Results.NotFound();
    var isSpaceOwner = booking.Resource.Space.OwnerId == userId;
    if (booking.UserId != userId && !IsAdmin(user) && !isSpaceOwner) return Results.Forbid();
    db.Bookings.Remove(booking);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// --- Profile API ---
var profileApi = app.MapGroup("/api/profile").RequireAuthorization();

profileApi.MapGet("/", async (ClaimsPrincipal user, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var userUrl = $"{adminUrl}/admin/realms/{realm}/users/{userId}";
    var client = httpClientFactory.CreateClient("keycloak-account");
    var req = new HttpRequestMessage(HttpMethod.Get, userUrl);
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var res = await client.SendAsync(req);
    if (!res.IsSuccessStatusCode) return Results.StatusCode((int)res.StatusCode);
    var kcUser = await res.Content.ReadFromJsonAsync<KeycloakUserRepresentation>();
    return Results.Ok(new { firstName = kcUser?.FirstName, lastName = kcUser?.LastName, email = kcUser?.Email, attributes = kcUser?.Attributes });
});

profileApi.MapPost("/", async (ClaimsPrincipal user, ProfileUpdateRequest body, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var userUrl = $"{adminUrl}/admin/realms/{realm}/users/{userId}";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var getReq = new HttpRequestMessage(HttpMethod.Get, userUrl);
    getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var getRes = await client.SendAsync(getReq);
    var existing = getRes.IsSuccessStatusCode ? await getRes.Content.ReadFromJsonAsync<KeycloakUserRepresentation>() : null;

    var mergedAttributes = existing?.Attributes ?? new Dictionary<string, List<string>>();
    if (body.Attributes is not null)
        foreach (var kv in body.Attributes)
            mergedAttributes[kv.Key] = kv.Value;

    var update = new KeycloakUserRepresentation { FirstName = body.FirstName, LastName = body.LastName, Email = body.Email, Attributes = mergedAttributes };
    var putReq = new HttpRequestMessage(HttpMethod.Put, userUrl);
    putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    putReq.Content = JsonContent.Create(update);
    var putRes = await client.SendAsync(putReq);
    return putRes.IsSuccessStatusCode ? Results.NoContent() : Results.StatusCode((int)putRes.StatusCode);
});

// --- Passkeys ---

profileApi.MapGet("/passkeys", async (ClaimsPrincipal user, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var req = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users/{userId}/credentials");
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var res = await client.SendAsync(req);
    if (!res.IsSuccessStatusCode) return Results.StatusCode((int)res.StatusCode);

    var creds = await res.Content.ReadFromJsonAsync<List<KeycloakCredentialRepresentation>>();
    var passkeys = (creds ?? [])
        .Where(c => c.Type == "webauthn-passwordless")
        .Select(c => new { c.Id, c.Type, c.UserLabel, c.CreatedDate });
    return Results.Ok(passkeys);
});

profileApi.MapDelete("/passkeys/{credentialId}", async (string credentialId, ClaimsPrincipal user, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var req = new HttpRequestMessage(HttpMethod.Delete, $"{adminUrl}/admin/realms/{realm}/users/{userId}/credentials/{credentialId}");
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var res = await client.SendAsync(req);
    return res.IsSuccessStatusCode ? Results.NoContent() : Results.StatusCode((int)res.StatusCode);
});

// --- Admin API ---
var adminGroup = app.MapGroup("/api/admin").RequireAuthorization();

adminGroup.MapGet("/users", async (ClaimsPrincipal user, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    if (!IsAdmin(user)) return Results.Forbid();
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);
    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var usersReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users?max=1000");
    usersReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var usersRes = await client.SendAsync(usersReq);
    if (!usersRes.IsSuccessStatusCode) return Results.StatusCode((int)usersRes.StatusCode);
    var users = await usersRes.Content.ReadFromJsonAsync<List<KeycloakUserRepresentation>>();

    var usersWithRoles = await Task.WhenAll((users ?? []).Select(async u =>
    {
        var rolesClient = httpClientFactory.CreateClient("keycloak-account");
        var rolesReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users/{u.Id}/role-mappings/realm");
        rolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var rolesRes = await rolesClient.SendAsync(rolesReq);
        var roles = rolesRes.IsSuccessStatusCode
            ? (await rolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? []).Where(r => r.Name is "member" or "admin" or "tenant-admin").Select(r => r.Name!).ToList()
            : new List<string>();
        return new { id = u.Id, username = u.Username, firstName = u.FirstName, lastName = u.LastName, email = u.Email, phoneNumber = u.Attributes?.GetValueOrDefault("phone_number")?[0], roles };
    }));
    return Results.Ok(usersWithRoles);
});

adminGroup.MapPost("/users", async (ClaimsPrincipal user, AdminCreateUserRequest body, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    if (!IsAdmin(user)) return Results.Forbid();
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);
    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var attrs = new Dictionary<string, List<string>>();
    if (!string.IsNullOrWhiteSpace(body.PhoneNumber)) attrs["phone_number"] = [body.PhoneNumber];

    var newUser = new KeycloakUserRepresentation
    {
        Username = body.Email, Email = body.Email, FirstName = body.FirstName, LastName = body.LastName,
        Enabled = true, Attributes = attrs.Count > 0 ? attrs : null,
        Credentials = [new KeycloakCredentialRepresentation { Value = body.TemporaryPassword, Temporary = true }],
    };

    var createReq = new HttpRequestMessage(HttpMethod.Post, $"{adminUrl}/admin/realms/{realm}/users");
    createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    createReq.Content = JsonContent.Create(newUser);
    var createRes = await client.SendAsync(createReq);
    if (!createRes.IsSuccessStatusCode) return Results.StatusCode((int)createRes.StatusCode);

    var newUserId = createRes.Headers.Location?.Segments.Last();
    if (newUserId is null) return Results.StatusCode(500);

    if (body.Roles is { Count: > 0 })
    {
        var allRolesReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/roles");
        allRolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var allRolesRes = await client.SendAsync(allRolesReq);
        var allRoles = allRolesRes.IsSuccessStatusCode ? await allRolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? [] : [];
        var toAssign = allRoles.Where(r => body.Roles.Contains(r.Name!)).ToList();
        if (toAssign.Count > 0)
        {
            var assignReq = new HttpRequestMessage(HttpMethod.Post, $"{adminUrl}/admin/realms/{realm}/users/{newUserId}/role-mappings/realm");
            assignReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            assignReq.Content = JsonContent.Create(toAssign);
            await client.SendAsync(assignReq);
        }
    }
    return Results.Created($"/api/admin/users/{newUserId}", new { id = newUserId });
});

adminGroup.MapPut("/users/{userId}", async (string userId, ClaimsPrincipal user, AdminUpdateUserRequest body, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    if (!IsAdmin(user)) return Results.Forbid();
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);
    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = httpClientFactory.CreateClient("keycloak-account");

    var getReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users/{userId}");
    getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var getRes = await client.SendAsync(getReq);
    var existing = getRes.IsSuccessStatusCode ? await getRes.Content.ReadFromJsonAsync<KeycloakUserRepresentation>() : null;

    var mergedAttrs = existing?.Attributes ?? new Dictionary<string, List<string>>();
    if (body.PhoneNumber is not null) mergedAttrs["phone_number"] = [body.PhoneNumber];

    var update = new KeycloakUserRepresentation { FirstName = body.FirstName, LastName = body.LastName, Email = body.Email, Attributes = mergedAttrs };
    var putReq = new HttpRequestMessage(HttpMethod.Put, $"{adminUrl}/admin/realms/{realm}/users/{userId}");
    putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    putReq.Content = JsonContent.Create(update);
    var putRes = await client.SendAsync(putReq);
    if (!putRes.IsSuccessStatusCode) return Results.StatusCode((int)putRes.StatusCode);

    var currentRolesReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/users/{userId}/role-mappings/realm");
    currentRolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var currentRolesRes = await client.SendAsync(currentRolesReq);
    var currentRoles = currentRolesRes.IsSuccessStatusCode
        ? (await currentRolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? []).Where(r => r.Name is "member" or "admin" or "tenant-admin").ToList()
        : [];

    var currentNames = currentRoles.Select(r => r.Name!).ToHashSet();
    var desiredNames = body.Roles.ToHashSet();
    var toAdd = desiredNames.Except(currentNames).ToList();
    var toRemove = currentRoles.Where(r => !desiredNames.Contains(r.Name!)).ToList();

    if (toAdd.Count > 0)
    {
        var allRolesReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/{realm}/roles");
        allRolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var allRolesRes = await client.SendAsync(allRolesReq);
        var allRoles = allRolesRes.IsSuccessStatusCode ? await allRolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? [] : [];
        var addObjs = allRoles.Where(r => toAdd.Contains(r.Name!)).ToList();
        if (addObjs.Count > 0)
        {
            var addReq = new HttpRequestMessage(HttpMethod.Post, $"{adminUrl}/admin/realms/{realm}/users/{userId}/role-mappings/realm");
            addReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            addReq.Content = JsonContent.Create(addObjs);
            await client.SendAsync(addReq);
        }
    }
    if (toRemove.Count > 0)
    {
        var removeReq = new HttpRequestMessage(HttpMethod.Delete, $"{adminUrl}/admin/realms/{realm}/users/{userId}/role-mappings/realm");
        removeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        removeReq.Content = JsonContent.Create(toRemove);
        await client.SendAsync(removeReq);
    }
    return Results.NoContent();
});

app.MapDefaultEndpoints();
app.UseFileServer();
app.Run();

// Keycloak helper functions
static async Task<string?> GetKeycloakAdminTokenAsync(IConfiguration config, IHttpClientFactory factory, bool isDevelopment)
{
    var adminUrl = config["Keycloak:AdminUrl"];
    if (!isDevelopment) adminUrl = adminUrl?.Replace("http://", "https://");
    var password = config["Keycloak:AdminPassword"] ?? "admin";
    if (string.IsNullOrEmpty(adminUrl)) return null;

    var client = factory.CreateClient("keycloak-account");
    var form = new FormUrlEncodedContent([
        new("grant_type", "password"),
        new("client_id", "admin-cli"),
        new("username", "admin"),
        new("password", password),
    ]);
    var res = await client.PostAsync($"{adminUrl}/realms/master/protocol/openid-connect/token", form);
    if (!res.IsSuccessStatusCode) return null;
    var json = await res.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>();
    return json.GetProperty("access_token").GetString();
}

static string GetKeycloakAdminUrl(IConfiguration config, bool isDevelopment)
{
    var url = config["Keycloak:AdminUrl"] ?? "";
    return isDevelopment ? url : url.Replace("http://", "https://");
}

static async Task CreateKeycloakGroupAsync(IConfiguration config, IHttpClientFactory factory, bool isDevelopment, string groupPath)
{
    var adminToken = await GetKeycloakAdminTokenAsync(config, factory, isDevelopment);
    if (adminToken is null) return;
    var adminUrl = GetKeycloakAdminUrl(config, isDevelopment);
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = factory.CreateClient("keycloak-account");

    // groupPath is "spaces/my-slug" — create parent "spaces" first if needed, then child
    var parts = groupPath.Split('/');
    string? parentId = null;
    foreach (var part in parts)
    {
        var searchReq = new HttpRequestMessage(HttpMethod.Get, parentId is null
            ? $"{adminUrl}/admin/realms/{realm}/groups?search={Uri.EscapeDataString(part)}&exact=true&top=true"
            : $"{adminUrl}/admin/realms/{realm}/groups/{parentId}/children?search={Uri.EscapeDataString(part)}");
        searchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var searchRes = await client.SendAsync(searchReq);
        var groups = searchRes.IsSuccessStatusCode
            ? await searchRes.Content.ReadFromJsonAsync<List<KeycloakGroupRepresentation>>()
            : null;
        var existing = groups?.FirstOrDefault(g => g.Name == part);
        if (existing is not null)
        {
            parentId = existing.Id;
            continue;
        }
        var createUrl = parentId is null
            ? $"{adminUrl}/admin/realms/{realm}/groups"
            : $"{adminUrl}/admin/realms/{realm}/groups/{parentId}/children";
        var createReq = new HttpRequestMessage(HttpMethod.Post, createUrl);
        createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        createReq.Content = JsonContent.Create(new { name = part });
        var createRes = await client.SendAsync(createReq);
        if (createRes.IsSuccessStatusCode || createRes.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            var newLocation = createRes.Headers.Location?.ToString();
            var newId = newLocation?.Split('/').LastOrDefault();
            if (!string.IsNullOrEmpty(newId))
            {
                parentId = newId;
            }
            else
            {
                // Location header missing — re-fetch to find the group
                var refetchUrl = parentId is null
                    ? $"{adminUrl}/admin/realms/{realm}/groups?search={Uri.EscapeDataString(part)}&exact=true&top=true"
                    : $"{adminUrl}/admin/realms/{realm}/groups/{parentId}/children?search={Uri.EscapeDataString(part)}";
                var refetchReq = new HttpRequestMessage(HttpMethod.Get, refetchUrl);
                refetchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
                var refetchRes = await client.SendAsync(refetchReq);
                if (!refetchRes.IsSuccessStatusCode) return;
                var refetched = await refetchRes.Content.ReadFromJsonAsync<List<KeycloakGroupRepresentation>>();
                parentId = refetched?.FirstOrDefault(g => g.Name == part)?.Id;
                if (parentId is null) return;
            }
        }
    }
}

static async Task AddUserToKeycloakGroupAsync(IConfiguration config, IHttpClientFactory factory, bool isDevelopment, string userId, string groupPath)
{
    var adminToken = await GetKeycloakAdminTokenAsync(config, factory, isDevelopment);
    if (adminToken is null) return;
    var adminUrl = GetKeycloakAdminUrl(config, isDevelopment);
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = factory.CreateClient("keycloak-account");
    var groupId = await FindKeycloakGroupIdAsync(client, adminToken, adminUrl, realm, groupPath);
    if (groupId is null) return;
    var req = new HttpRequestMessage(HttpMethod.Put, $"{adminUrl}/admin/realms/{realm}/users/{userId}/groups/{groupId}");
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    await client.SendAsync(req);
}

static async Task RemoveUserFromKeycloakGroupAsync(IConfiguration config, IHttpClientFactory factory, bool isDevelopment, string userId, string groupPath)
{
    var adminToken = await GetKeycloakAdminTokenAsync(config, factory, isDevelopment);
    if (adminToken is null) return;
    var adminUrl = GetKeycloakAdminUrl(config, isDevelopment);
    var realm = config["Keycloak:RealmName"] ?? "bookit";
    var client = factory.CreateClient("keycloak-account");
    var groupId = await FindKeycloakGroupIdAsync(client, adminToken, adminUrl, realm, groupPath);
    if (groupId is null) return;
    var req = new HttpRequestMessage(HttpMethod.Delete, $"{adminUrl}/admin/realms/{realm}/users/{userId}/groups/{groupId}");
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    await client.SendAsync(req);
}

static async Task<string?> FindKeycloakGroupIdAsync(HttpClient client, string adminToken, string adminUrl, string realm, string groupPath)
{
    var parts = groupPath.Split('/');
    string? parentId = null;
    string? groupId = null;
    foreach (var part in parts)
    {
        var searchUrl = parentId is null
            ? $"{adminUrl}/admin/realms/{realm}/groups?search={Uri.EscapeDataString(part)}&exact=true&top=true"
            : $"{adminUrl}/admin/realms/{realm}/groups/{parentId}/children?search={Uri.EscapeDataString(part)}";
        var searchReq = new HttpRequestMessage(HttpMethod.Get, searchUrl);
        searchReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var searchRes = await client.SendAsync(searchReq);
        if (!searchRes.IsSuccessStatusCode) return null;
        var groups = await searchRes.Content.ReadFromJsonAsync<List<KeycloakGroupRepresentation>>();
        var found = groups?.FirstOrDefault(g => g.Name == part);
        if (found is null) return null;
        parentId = found.Id;
        groupId = found.Id;
    }
    return groupId;
}

static string GenerateSecureToken()
    => Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32))
        .Replace("+", "-").Replace("/", "_").TrimEnd('=');

// Request/Response records
record CreateSpaceRequest(string Name, string Slug, string? Description, string? Visibility);
record UpdateSpaceRequest(string? Name, string? Description, string? Visibility);
record AddMemberRequest(string? UserId, string? Email, string? Role, string? FirstName, string? LastName, bool Create = false);
record CreateInvitationsRequest(List<string>? Emails, string? Role);
record CreateResourceRequest(string Name, string? Description, string ResourceType, int SlotDurationMinutes, int MaxAdvanceDays);
record UpdateResourceRequest(string? Name, string? Description, string? ResourceType, int SlotDurationMinutes, int MaxAdvanceDays, bool? IsActive);
record CreateBookingRequest(int ResourceId, DateOnly Date, TimeOnly StartTime);
record ProfileUpdateRequest(string? FirstName, string? LastName, string? Email, Dictionary<string, List<string>>? Attributes);

class KeycloakUserRepresentation
{
    [System.Text.Json.Serialization.JsonPropertyName("id")] public string? Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("username")] public string? Username { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("enabled")] public bool Enabled { get; set; } = true;
    [System.Text.Json.Serialization.JsonPropertyName("firstName")] public string? FirstName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("lastName")] public string? LastName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("email")] public string? Email { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("attributes")] public Dictionary<string, List<string>>? Attributes { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("credentials")] public List<KeycloakCredentialRepresentation>? Credentials { get; set; }
}
class KeycloakCredentialRepresentation
{
    [System.Text.Json.Serialization.JsonPropertyName("id")] public string? Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("type")] public string Type { get; set; } = "password";
    [System.Text.Json.Serialization.JsonPropertyName("userLabel")] public string? UserLabel { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("createdDate")] public long? CreatedDate { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("value")] public string Value { get; set; } = "";
    [System.Text.Json.Serialization.JsonPropertyName("temporary")] public bool Temporary { get; set; } = true;
}
class KeycloakRoleRepresentation
{
    [System.Text.Json.Serialization.JsonPropertyName("id")] public string? Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("name")] public string? Name { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("composite")] public bool Composite { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("clientRole")] public bool ClientRole { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("containerId")] public string? ContainerId { get; set; }
}
record AdminCreateUserRequest(string? FirstName, string? LastName, string Email, string? PhoneNumber, string TemporaryPassword, List<string>? Roles);
record AdminUpdateUserRequest(string? FirstName, string? LastName, string? Email, string? PhoneNumber, List<string> Roles);
class KeycloakGroupRepresentation
{
    [System.Text.Json.Serialization.JsonPropertyName("id")] public string? Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("name")] public string? Name { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("path")] public string? Path { get; set; }
}
