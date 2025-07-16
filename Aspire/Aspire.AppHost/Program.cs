var builder = DistributedApplication.CreateBuilder(args);

var keycloak = builder.AddKeycloak("keycloak", 8080)
    .WithRealmImport("./Realm/realm-weather.json")
     .WithDataVolume();

var api = builder.AddProject<Projects.BookIt_Api>("api")
    .WithReference(keycloak)
    .WaitFor(keycloak);

builder.AddProject<Projects.BookIt_Web>("web")
    .WithReference(api)
    .WaitFor(keycloak);

builder.Build().Run();
