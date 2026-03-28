using Aspire.Hosting.Azure;

var builder = DistributedApplication.CreateBuilder(args);

var realmName = "bookit";

// Keycloak admin password parameter
var keycloakPassword = builder.AddParameter("KeycloakPassword", secret: true, value: "admin");

// Keycloak resource
var keycloak = builder.AddKeycloak("keycloak", adminPassword: keycloakPassword)
    .WithEnvironment("KC_HTTP_ENABLED", "true")
    .WithEnvironment("KC_PROXY_HEADERS", "xforwarded")
    .WithEnvironment("KC_HOSTNAME_STRICT", "false")
    .WithEndpoint("http", e => e.IsExternal = true);

// App PostgreSQL database — declared up front so both branches of the if/else can
// assign it; the interface type works because IResourceBuilder<out T> is covariant.
IResourceBuilder<IResourceWithConnectionString> appDb;

if (builder.ExecutionContext.IsRunMode)
{
    // Local dev: Docker PostgreSQL + Keycloak with realm import
    keycloak.WithDataVolume()
            .WithRealmImport("../realms");

    appDb = builder.AddPostgres("appdb").WithDataVolume().AddDatabase("bookitdb");
}
else
{
    // Azure publish: explicit Azure PostgreSQL for both Keycloak and the app so
    // database names are predictable and not derived from auto-generated resource names.
    builder.AddAzureContainerAppEnvironment("cae");

    // Single shared PostgreSQL server — both Keycloak and the app use separate databases on it.
    var postgresUser = builder.AddParameter("PostgresUser", value: "bookit");
    var postgresPassword = builder.AddParameter("PostgresPassword", secret: true, value: "Password1!");

    var sharedPostgres = builder.AddAzurePostgresFlexibleServer("postgres")
        .WithPasswordAuthentication(postgresUser, postgresPassword);

    var keycloakDb = sharedPostgres.AddDatabase("keycloakDB", "keycloak");

    var keycloakDbUrl = ReferenceExpression.Create(
        $"jdbc:postgresql://{sharedPostgres.GetOutput("hostName")}/{keycloakDb.Resource.DatabaseName}"
    );

    keycloak
        .WithEnvironment("KC_DB", "postgres")
        .WithEnvironment("KC_DB_URL", keycloakDbUrl)
        .WithEnvironment("KC_DB_USERNAME", postgresUser)
        .WithEnvironment("KC_DB_PASSWORD", postgresPassword);

    // Use ACR-cached Keycloak image if available (set by the postprovision hook).
    // Falls back to quay.io on the very first provision when AcrEndpoint is not yet set.
    var acrEndpoint = Environment.GetEnvironmentVariable("AcrEndpoint") ?? "";
    if (!string.IsNullOrEmpty(acrEndpoint))
    {
        keycloak.WithImageRegistry(acrEndpoint);
    }

    appDb = sharedPostgres.AddDatabase("bookitdb");
}

// API server
var server = builder.AddProject<Projects.BookIt_Server>("server")
    .WithReference(appDb)
    .WithReference(keycloak)
    // Inject the real Keycloak URL so the JWT Bearer backchannel (which does not go
    // through Aspire service discovery) can fetch signing keys without resolving
    // the "keycloak" service-discovery hostname that is set in appsettings.json.
    .WithEnvironment("Keycloak__Authority",
        ReferenceExpression.Create($"{keycloak.GetEndpoint("http")}/realms/{realmName}"))
    .WithEnvironment("Keycloak__ExternalAuthority",
        ReferenceExpression.Create($"{keycloak.GetEndpoint("http")}/realms/{realmName}"))
    .WithEnvironment("Keycloak__AdminUrl",
        ReferenceExpression.Create($"{keycloak.GetEndpoint("http")}"))
    .WithEnvironment("Keycloak__AdminPassword", keycloakPassword)
    .WaitFor(appDb)
    .WaitFor(keycloak)
    .WithHttpHealthCheck("/health")
    .WithExternalHttpEndpoints();

// Augment PATH so Aspire can find npm regardless of how Node was installed
// (Homebrew ARM, Homebrew Intel, nvm, volta, fnm)
var nvmDefaultBin = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
    ".nvm", "versions", "node",
    Directory.EnumerateDirectories(
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".nvm", "versions", "node")
    ).Select(Path.GetFileName).OrderDescending().FirstOrDefault() ?? "",
    "bin");

var nodePaths = new[]
{
    nvmDefaultBin,
    "/opt/homebrew/bin",
    "/usr/local/bin",
    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".volta/bin"),
    Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".fnm/aliases/default/bin"),
};
var extraPath = string.Join(":", nodePaths.Where(Directory.Exists));
var currentPath = Environment.GetEnvironmentVariable("PATH") ?? string.Empty;
var fullPath = string.IsNullOrEmpty(extraPath) ? currentPath : $"{extraPath}:{currentPath}";

// React frontend — basicSsl() in vite.config.ts makes Vite serve HTTPS,
// so we mark the endpoint scheme as https so the Aspire dashboard shows the correct URL.
var webfrontend = builder.AddViteApp("webfrontend", "../frontend")
    .WithEndpoint("http", e => e.UriScheme = "https")
    .WithReference(server)
    .WithEnvironment("VITE_KEYCLOAK_URL", keycloak.GetEndpoint("http"))
    .WithEnvironment("PATH", fullPath)
    .WaitFor(server);

server.PublishWithContainerFiles(webfrontend, "wwwroot");

builder.Build().Run();
