var builder = DistributedApplication.CreateBuilder(args);

var keycloak = builder.AddKeycloak("keycloak", 8080)
    .WithRealmImport("./Realm/realm-weather.json")
     .WithDataVolume();

var weatherApi = builder.AddProject<Projects.MinimalApiJwt>("weatherapi")
    .WithReference(keycloak)
    .WaitFor(keycloak);

builder.AddProject<Projects.BlazorWebAppOidc>("blazorfrontend")
    .WithReference(weatherApi)
    .WaitFor(keycloak);

builder.Build().Run();
