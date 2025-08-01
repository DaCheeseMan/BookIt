using FastEndpoints;
using Microsoft.AspNetCore.Authentication.JwtBearer;

var builder = WebApplication.CreateBuilder(args);

// Add service defaults & Aspire components.
builder.AddServiceDefaults();

builder.Services.AddAuthentication()
    .AddJwtBearer("Bearer", jwtOptions =>
    {
        // {TENANT ID} is the directory (tenant) ID.
        //
        // Authority format {AUTHORITY} matches the issuer (`iss`) of the JWT returned by the identity provider.
        //
        // Authority format {AUTHORITY} for ME-ID tenant type: https://sts.windows.net/{TENANT ID}/
        // Authority format {AUTHORITY} for B2C tenant type: https://login.microsoftonline.com/{TENANT ID}/v2.0/
        //
        jwtOptions.Authority = "http://localhost:8080/realms/weather";
        jwtOptions.RequireHttpsMetadata = false;
        //
        // The following should match just the path of the Application ID URI configured when adding the "Weather.Get" scope
        // under "Expose an API" in the Azure or Entra portal. {CLIENT ID} is the application (client) ID of this
        // app's registration in the Azure portal.
        //
        // Audience format {AUDIENCE} for ME-ID tenant type: api://{CLIENT ID}
        // Audience format {AUDIENCE} for B2C tenant type: https://{DIRECTORY NAME}.onmicrosoft.com/{CLIENT ID}
        //
        jwtOptions.Audience = "weatherapi";

        jwtOptions.Events = new JwtBearerEvents
        {
            OnAuthenticationFailed = context =>
            {
                System.Diagnostics.Debug.WriteLine("Authentication failed: " + context.Exception.Message);
                return Task.CompletedTask;
            }
        };

    });
builder.Services.AddAuthorization(options =>
{
    // Define a policy that requires the "Member" role.
    options.AddPolicy("Member", policy =>
    {
        policy.RequireAuthenticatedUser();
        policy.RequireRole("Member");
    });
});

// Add OpenApi
builder.Services.AddOpenApi();

// Add Postgres DB
builder.AddNpgsqlDataSource(connectionName: "bookit");

// Add fast endpoints
builder.Services.AddFastEndpoints();

var app = builder.Build();

// Use fast endpoints
app.UseFastEndpoints();

// Configure Swagger UI
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/openapi/v1.json", "v1");
    });
}

// Configure the HTTP request pipeline.
app.UseHttpsRedirection();

app.MapDefaultEndpoints();

var summaries = new[]
{
    "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
};

app.MapGet("/weather-forecast", () =>
{
    var forecast = Enumerable.Range(1, 5).Select(index =>
        new WeatherForecast
        (
            DateOnly.FromDateTime(DateTime.Now.AddDays(index)),
            Random.Shared.Next(-20, 55),
            summaries[Random.Shared.Next(summaries.Length)]
        ))
        .ToArray();
    return forecast;
}).RequireAuthorization();

app.Run();

internal record WeatherForecast(DateOnly Date, int TemperatureC, string? Summary)
{
    public int TemperatureF => 32 + (int)(TemperatureC / 0.5556);
}
