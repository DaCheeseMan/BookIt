using JtK.Server.Data;
using JtK.Server.Models;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Net.Http.Headers;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire client integrations.
builder.AddServiceDefaults();

// PostgreSQL via Aspire
builder.AddNpgsqlDbContext<AppDbContext>("jtkdb");

// JWT Bearer authentication with Keycloak
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Keycloak:Authority"];
        options.Audience = "jtk-web";
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

// Ignore navigation-property cycles when serialising EF entities directly
builder.Services.ConfigureHttpJsonOptions(o =>
    o.SerializerOptions.ReferenceHandler =
        System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

// CORS for React frontend
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

// Named HttpClient for proxying requests to the Keycloak Admin API.
builder.Services.AddHttpClient("keycloak-account");

var app = builder.Build();

app.UseExceptionHandler();
app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

// Apply EF migrations on every startup in all environments.
// This creates the schema and seeds the courts data on first run.
// Retry with exponential back-off to handle the race where PostgreSQL passes its
// health check before it is fully ready to serve DDL (common on cold container starts).
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var migrationLogger = scope.ServiceProvider
        .GetRequiredService<ILogger<AppDbContext>>();

    const int maxAttempts = 8;
    for (var attempt = 1; attempt <= maxAttempts; attempt++)
    {
        try
        {
            // Note: EF logs a "Failed executing DbCommand" for the __EFMigrationsHistory
            // SELECT on a brand-new database — that is normal first-run behaviour.
            // MigrateAsync handles it internally and creates the table before proceeding.
            await db.Database.MigrateAsync();
            break;
        }
        catch (Exception ex) when (attempt < maxAttempts)
        {
            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt - 1)); // 1s, 2s, 4s, 8s…
            migrationLogger.LogWarning(ex,
                "Migration attempt {Attempt}/{Max} failed. Retrying in {Delay}s…",
                attempt, maxAttempts, delay.TotalSeconds);
            await Task.Delay(delay);
        }
    }
}

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// --- Courts endpoints (public) ---
var courtsApi = app.MapGroup("/api/courts");

courtsApi.MapGet("/", async (AppDbContext db) =>
    await db.Courts.Where(c => c.IsActive).ToListAsync());

courtsApi.MapGet("/{id:int}", async (int id, AppDbContext db) =>
    await db.Courts.FindAsync(id) is Court court && court.IsActive
        ? Results.Ok(court)
        : Results.NotFound());

// Returns all bookings for a court in a date range (for the weekly calendar)
courtsApi.MapGet("/{id:int}/bookings", async (int id, DateOnly from, DateOnly to, ClaimsPrincipal user, AppDbContext db) =>
{
    var isAuthenticated = user.Identity?.IsAuthenticated == true;
    var bookings = await db.Bookings
        .Where(b => b.CourtId == id && b.Date >= from && b.Date <= to)
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

// --- Bookings endpoints (authenticated) ---

// Keycloak puts realm roles in realm_access.roles in the JWT.
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

// Admins are implicitly members too.
static bool IsMember(ClaimsPrincipal user)
{
    var raw = user.FindFirstValue("realm_access");
    if (raw is null) return false;
    try
    {
        var doc = System.Text.Json.JsonDocument.Parse(raw);
        if (doc.RootElement.TryGetProperty("roles", out var roles))
            return roles.EnumerateArray().Any(r => r.GetString() is "member" or "admin");
    }
    catch { }
    return false;
}

var bookingsApi = app.MapGroup("/api/bookings").RequireAuthorization();

bookingsApi.MapGet("/", async (ClaimsPrincipal user, AppDbContext db) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
              ?? user.FindFirstValue("sub")!;
    return await db.Bookings
        .Include(b => b.Court)
        .Where(b => b.UserId == userId)
        .OrderByDescending(b => b.Date).ThenBy(b => b.StartTime)
        .ToListAsync();
});

bookingsApi.MapPost("/", async (CreateBookingRequest req, ClaimsPrincipal user, AppDbContext db) =>
{
    if (!IsMember(user))
        return Results.Forbid();

    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
              ?? user.FindFirstValue("sub")!;
    var userName = user.FindFirstValue(ClaimTypes.Name)
                ?? user.FindFirstValue("preferred_username")
                ?? userId;
    var userFirstName = user.FindFirstValue(ClaimTypes.GivenName)
                     ?? user.FindFirstValue("given_name") ?? string.Empty;
    var userLastName = user.FindFirstValue(ClaimTypes.Surname)
                    ?? user.FindFirstValue("family_name") ?? string.Empty;
    var userPhone = user.FindFirstValue("phone_number") ?? string.Empty;

    var court = await db.Courts.FindAsync(req.CourtId);
    if (court is null || !court.IsActive)
        return Results.BadRequest("Court not found.");

    var start = new TimeOnly(req.StartHour, 0);
    var end = start.AddHours(1);

    // Reject bookings in the past (compare date + time against current local time)
    var nowUtc = DateTime.UtcNow;
    var today = DateOnly.FromDateTime(nowUtc);
    var nowTime = TimeOnly.FromDateTime(nowUtc);
    if (req.Date < today || (req.Date == today && start <= nowTime))
        return Results.BadRequest("Cannot book a slot in the past.");

    // Max 2 future bookings per user (admins are exempt)
    if (!IsAdmin(user))
    {
        var futureCount = await db.Bookings.CountAsync(b =>
            b.UserId == userId &&
            (b.Date > today || (b.Date == today && b.StartTime > nowTime)));
        if (futureCount >= 2)
            return Results.BadRequest("Du kan inte ha fler än 2 kommande bokningar.");
    }

    var overlap = await db.Bookings.AnyAsync(b =>
        b.CourtId == req.CourtId &&
        b.Date == req.Date &&
        b.StartTime == start);

    if (overlap)
        return Results.Conflict("That slot is already booked.");

    var booking = new Booking
    {
        CourtId = req.CourtId,
        UserId = userId,
        UserName = userName,
        UserFirstName = userFirstName,
        UserLastName = userLastName,
        UserPhone = userPhone,
        Date = req.Date,
        StartTime = start,
        EndTime = end
    };

    db.Bookings.Add(booking);
    await db.SaveChangesAsync();
    return Results.Created($"/api/bookings/{booking.Id}", booking);
});

bookingsApi.MapDelete("/{id:int}", async (int id, ClaimsPrincipal user, AppDbContext db) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)
              ?? user.FindFirstValue("sub")!;
    var booking = await db.Bookings.FindAsync(id);
    if (booking is null) return Results.NotFound();
    if (booking.UserId != userId && !IsAdmin(user)) return Results.Forbid();

    db.Bookings.Remove(booking);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

// Runtime config for the frontend (Keycloak authority must be the browser-reachable URL)
app.MapGet("/api/config", (IConfiguration config, IWebHostEnvironment env) =>
{
    var authority = config["Keycloak:ExternalAuthority"] ?? config["Keycloak:Authority"] ?? "";
    // Azure Container Apps terminates TLS externally — ensure the browser gets an HTTPS URL
    if (!env.IsDevelopment())
        authority = authority.Replace("http://", "https://");
    return Results.Ok(new { keycloakAuthority = authority });
});

// --- Profile endpoints (authenticated) ---
// Uses the Keycloak Admin REST API server-side so there are no browser CORS issues
// and no dependency on the token's audience claim.
var profileApi = app.MapGroup("/api/profile").RequireAuthorization();

profileApi.MapGet("/", async (ClaimsPrincipal user, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var userUrl = $"{adminUrl}/admin/realms/jtk/users/{userId}";
    var client = httpClientFactory.CreateClient("keycloak-account");
    var req = new HttpRequestMessage(HttpMethod.Get, userUrl);
    req.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);

    var res = await client.SendAsync(req);
    if (!res.IsSuccessStatusCode) return Results.StatusCode((int)res.StatusCode);

    var kcUser = await res.Content.ReadFromJsonAsync<KeycloakUserRepresentation>();
    return Results.Ok(new
    {
        firstName = kcUser?.FirstName,
        lastName = kcUser?.LastName,
        email = kcUser?.Email,
        attributes = kcUser?.Attributes,
    });
});

profileApi.MapPost("/", async (ClaimsPrincipal user, ProfileUpdateRequest body, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    var userId = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub")!;
    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var userUrl = $"{adminUrl}/admin/realms/jtk/users/{userId}";
    var client = httpClientFactory.CreateClient("keycloak-account");

    // Merge attributes from the body with any existing attributes
    var getReq = new HttpRequestMessage(HttpMethod.Get, userUrl);
    getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var getRes = await client.SendAsync(getReq);
    var existing = getRes.IsSuccessStatusCode
        ? await getRes.Content.ReadFromJsonAsync<KeycloakUserRepresentation>()
        : null;

    var mergedAttributes = existing?.Attributes ?? new Dictionary<string, List<string>>();
    if (body.Attributes is not null)
        foreach (var kv in body.Attributes)
            mergedAttributes[kv.Key] = kv.Value;

    var update = new KeycloakUserRepresentation
    {
        FirstName = body.FirstName,
        LastName = body.LastName,
        Email = body.Email,
        Attributes = mergedAttributes,
    };

    var putReq = new HttpRequestMessage(HttpMethod.Put, userUrl);
    putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    putReq.Content = JsonContent.Create(update);

    var putRes = await client.SendAsync(putReq);
    return putRes.IsSuccessStatusCode
        ? Results.NoContent()
        : Results.StatusCode((int)putRes.StatusCode);
});

// --- Admin endpoints (admin role required) ---
var adminGroup = app.MapGroup("/api/admin").RequireAuthorization();

adminGroup.MapGet("/users", async (ClaimsPrincipal user, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    if (!IsAdmin(user)) return Results.Forbid();

    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var client = httpClientFactory.CreateClient("keycloak-account");

    var usersReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/jtk/users?max=1000");
    usersReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var usersRes = await client.SendAsync(usersReq);
    if (!usersRes.IsSuccessStatusCode) return Results.StatusCode((int)usersRes.StatusCode);

    var users = await usersRes.Content.ReadFromJsonAsync<List<KeycloakUserRepresentation>>();

    // Fetch realm roles for each user in parallel
    var usersWithRoles = await Task.WhenAll((users ?? []).Select(async u =>
    {
        var rolesClient = httpClientFactory.CreateClient("keycloak-account");
        var rolesReq = new HttpRequestMessage(HttpMethod.Get,
            $"{adminUrl}/admin/realms/jtk/users/{u.Id}/role-mappings/realm");
        rolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var rolesRes = await rolesClient.SendAsync(rolesReq);
        var roles = rolesRes.IsSuccessStatusCode
            ? (await rolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? [])
                .Where(r => r.Name == "member" || r.Name == "admin")
                .Select(r => r.Name!)
                .ToList()
            : new List<string>();
        return new
        {
            id = u.Id,
            username = u.Username,
            firstName = u.FirstName,
            lastName = u.LastName,
            email = u.Email,
            phoneNumber = u.Attributes?.GetValueOrDefault("phone_number")?[0],
            roles,
        };
    }));

    return Results.Ok(usersWithRoles);
});

adminGroup.MapPost("/users", async (ClaimsPrincipal user, AdminCreateUserRequest body, IConfiguration config, IWebHostEnvironment env, IHttpClientFactory httpClientFactory) =>
{
    if (!IsAdmin(user)) return Results.Forbid();

    var adminToken = await GetKeycloakAdminTokenAsync(config, httpClientFactory, env.IsDevelopment());
    if (adminToken is null) return Results.StatusCode(502);

    var adminUrl = GetKeycloakAdminUrl(config, env.IsDevelopment());
    var client = httpClientFactory.CreateClient("keycloak-account");

    var attrs = new Dictionary<string, List<string>>();
    if (!string.IsNullOrWhiteSpace(body.PhoneNumber))
        attrs["phone_number"] = [body.PhoneNumber];

    var newUser = new KeycloakUserRepresentation
    {
        Username = body.Email,
        Email = body.Email,
        FirstName = body.FirstName,
        LastName = body.LastName,
        Enabled = true,
        Attributes = attrs.Count > 0 ? attrs : null,
        Credentials = [new KeycloakCredentialRepresentation { Value = body.TemporaryPassword, Temporary = true }],
    };

    var createReq = new HttpRequestMessage(HttpMethod.Post, $"{adminUrl}/admin/realms/jtk/users");
    createReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    createReq.Content = JsonContent.Create(newUser);
    var createRes = await client.SendAsync(createReq);
    if (!createRes.IsSuccessStatusCode) return Results.StatusCode((int)createRes.StatusCode);

    // Keycloak returns the new user URL in the Location header
    var newUserId = createRes.Headers.Location?.Segments.Last();
    if (newUserId is null) return Results.StatusCode(500);

    // Assign roles if requested
    if (body.Roles is { Count: > 0 })
    {
        var allRolesReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/jtk/roles");
        allRolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var allRolesRes = await client.SendAsync(allRolesReq);
        var allRoles = allRolesRes.IsSuccessStatusCode
            ? await allRolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? []
            : [];

        var toAssign = allRoles.Where(r => body.Roles.Contains(r.Name!)).ToList();
        if (toAssign.Count > 0)
        {
            var assignReq = new HttpRequestMessage(HttpMethod.Post,
                $"{adminUrl}/admin/realms/jtk/users/{newUserId}/role-mappings/realm");
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
    var client = httpClientFactory.CreateClient("keycloak-account");

    // Fetch existing user to merge attributes
    var getReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/jtk/users/{userId}");
    getReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var getRes = await client.SendAsync(getReq);
    var existing = getRes.IsSuccessStatusCode
        ? await getRes.Content.ReadFromJsonAsync<KeycloakUserRepresentation>()
        : null;

    var mergedAttrs = existing?.Attributes ?? new Dictionary<string, List<string>>();
    if (body.PhoneNumber is not null)
        mergedAttrs["phone_number"] = [body.PhoneNumber];

    var update = new KeycloakUserRepresentation
    {
        FirstName = body.FirstName,
        LastName = body.LastName,
        Email = body.Email,
        Attributes = mergedAttrs,
    };

    var putReq = new HttpRequestMessage(HttpMethod.Put, $"{adminUrl}/admin/realms/jtk/users/{userId}");
    putReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    putReq.Content = JsonContent.Create(update);
    var putRes = await client.SendAsync(putReq);
    if (!putRes.IsSuccessStatusCode) return Results.StatusCode((int)putRes.StatusCode);

    // Diff current roles vs desired and add/remove accordingly
    var currentRolesReq = new HttpRequestMessage(HttpMethod.Get,
        $"{adminUrl}/admin/realms/jtk/users/{userId}/role-mappings/realm");
    currentRolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
    var currentRolesRes = await client.SendAsync(currentRolesReq);
    var currentRoles = currentRolesRes.IsSuccessStatusCode
        ? (await currentRolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? [])
            .Where(r => r.Name == "member" || r.Name == "admin").ToList()
        : [];

    var currentNames = currentRoles.Select(r => r.Name!).ToHashSet();
    var desiredNames = body.Roles.ToHashSet();
    var toAdd = desiredNames.Except(currentNames).ToList();
    var toRemove = currentRoles.Where(r => !desiredNames.Contains(r.Name!)).ToList();

    if (toAdd.Count > 0)
    {
        var allRolesReq = new HttpRequestMessage(HttpMethod.Get, $"{adminUrl}/admin/realms/jtk/roles");
        allRolesReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        var allRolesRes = await client.SendAsync(allRolesReq);
        var allRoles = allRolesRes.IsSuccessStatusCode
            ? await allRolesRes.Content.ReadFromJsonAsync<List<KeycloakRoleRepresentation>>() ?? []
            : [];
        var addObjs = allRoles.Where(r => toAdd.Contains(r.Name!)).ToList();
        if (addObjs.Count > 0)
        {
            var addReq = new HttpRequestMessage(HttpMethod.Post,
                $"{adminUrl}/admin/realms/jtk/users/{userId}/role-mappings/realm");
            addReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            addReq.Content = JsonContent.Create(addObjs);
            await client.SendAsync(addReq);
        }
    }

    if (toRemove.Count > 0)
    {
        var removeReq = new HttpRequestMessage(HttpMethod.Delete,
            $"{adminUrl}/admin/realms/jtk/users/{userId}/role-mappings/realm");
        removeReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
        removeReq.Content = JsonContent.Create(toRemove);
        await client.SendAsync(removeReq);
    }

    return Results.NoContent();
});

app.MapDefaultEndpoints();
app.UseFileServer();

app.Run();

// Obtains a short-lived Keycloak admin token using the admin-cli client.
// In non-development environments the AdminUrl is injected as http:// by Aspire but
// Azure Container Apps external ingress only accepts HTTPS — upgrade the scheme here,
// consistent with the same pattern used in /api/config.
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

record CreateBookingRequest(int CourtId, DateOnly Date, int StartHour);
record ProfileUpdateRequest(
    string? FirstName,
    string? LastName,
    string? Email,
    Dictionary<string, List<string>>? Attributes);

class KeycloakUserRepresentation
{
    [System.Text.Json.Serialization.JsonPropertyName("id")]
    public string? Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("username")]
    public string? Username { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;
    [System.Text.Json.Serialization.JsonPropertyName("firstName")]
    public string? FirstName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("lastName")]
    public string? LastName { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("email")]
    public string? Email { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("attributes")]
    public Dictionary<string, List<string>>? Attributes { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("credentials")]
    public List<KeycloakCredentialRepresentation>? Credentials { get; set; }
}

class KeycloakCredentialRepresentation
{
    [System.Text.Json.Serialization.JsonPropertyName("type")]
    public string Type { get; set; } = "password";
    [System.Text.Json.Serialization.JsonPropertyName("value")]
    public string Value { get; set; } = "";
    [System.Text.Json.Serialization.JsonPropertyName("temporary")]
    public bool Temporary { get; set; } = true;
}

class KeycloakRoleRepresentation
{
    [System.Text.Json.Serialization.JsonPropertyName("id")]
    public string? Id { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("name")]
    public string? Name { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("composite")]
    public bool Composite { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("clientRole")]
    public bool ClientRole { get; set; }
    [System.Text.Json.Serialization.JsonPropertyName("containerId")]
    public string? ContainerId { get; set; }
}

record AdminCreateUserRequest(
    string? FirstName,
    string? LastName,
    string Email,
    string? PhoneNumber,
    string TemporaryPassword,
    List<string>? Roles);

record AdminUpdateUserRequest(
    string? FirstName,
    string? LastName,
    string? Email,
    string? PhoneNumber,
    List<string> Roles);


