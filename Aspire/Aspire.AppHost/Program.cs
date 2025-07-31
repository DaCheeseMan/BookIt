var builder = DistributedApplication.CreateBuilder(args);

var keycloak = builder.AddKeycloak("keycloak", 8080)
    .WithRealmImport("./Realm/realm-weather.json")
     .WithDataVolume();

var username = builder.AddParameter("db-username");
var password = builder.AddParameter("db-password", secret: true);
var postgres = builder.AddAzurePostgresFlexibleServer("postgres")
    .RunAsContainer(container =>
    {
        container.WithDataVolume();
    })
    .WithPasswordAuthentication(username, password);
var db = postgres.AddDatabase("bookit");

var api = builder.AddProject<Projects.BookIt_Api>("api")
    .WithReference(keycloak)
    .WithReference(db)
    .WaitFor(keycloak);

builder.AddProject<Projects.BookIt_Web>("web")
    .WithReference(api)
    .WaitFor(keycloak);

builder.Build().Run();
