using System.Net.Http.Json;

namespace BookIt.Web.Client.Weather;

internal sealed class ClientWeatherForecaster(HttpClient httpClient) : IWeatherForecaster
{
    public async Task<IEnumerable<WeatherForecast>> GetWeatherForecastAsync() =>
        await httpClient.GetFromJsonAsync<WeatherForecast[]>("/weather-forecast") ??
            throw new IOException("No weather forecast!");
}
