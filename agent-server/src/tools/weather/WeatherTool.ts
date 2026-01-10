import { DynamicTool } from "@langchain/core/tools";

/**
 * Weather tool using OpenWeatherMap API
 *
 * OpenWeatherMap provides comprehensive weather data with excellent location parsing.
 * Requires an API key but offers generous free tier (1000 calls/day).
 *
 * Features:
 * - Current weather conditions
 * - 5-day forecast
 * - Global coverage
 * - Excellent location parsing (handles "City, State", "City, Country" formats)
 * - Reliable and fast
 */

interface OpenWeatherMapResponse {
    name: string;
    sys: {
        country: string;
    };
    main: {
        temp: number;
        feels_like: number;
        humidity: number;
        pressure: number;
    };
    weather: Array<{
        main: string;
        description: string;
    }>;
    wind: {
        speed: number;
        deg: number;
    };
    visibility?: number;
    dt: number;
}

interface OpenWeatherMapForecastResponse {
    list: Array<{
        dt: number;
        main: {
            temp_max: number;
            temp_min: number;
        };
        weather: Array<{
            main: string;
            description: string;
        }>;
    }>;
}

/**
 * Get current weather from OpenWeatherMap
 */
async function getCurrentWeather(location: string): Promise<OpenWeatherMapResponse> {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
        throw new Error('OPENWEATHERMAP_API_KEY environment variable is required');
    }

    const encodedLocation = encodeURIComponent(location);
    const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodedLocation}&appid=${apiKey}&units=imperial`;

    const response = await fetch(weatherUrl);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Location not found: ${location}. Please check the spelling or try a different format.`);
        }
        throw new Error(`Weather API failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as OpenWeatherMapResponse;
}

/**
 * Get 5-day forecast from OpenWeatherMap
 */
async function getForecast(location: string): Promise<OpenWeatherMapForecastResponse> {
    const apiKey = process.env.OPENWEATHERMAP_API_KEY;
    if (!apiKey) {
        throw new Error('OPENWEATHERMAP_API_KEY environment variable is required');
    }

    const encodedLocation = encodeURIComponent(location);
    const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodedLocation}&appid=${apiKey}&units=imperial&cnt=24`; // 3 days worth (8 * 3)

    const response = await fetch(forecastUrl);
    if (!response.ok) {
        if (response.status === 404) {
            throw new Error(`Location not found: ${location}. Please check the spelling or try a different format.`);
        }
        throw new Error(`Forecast API failed: ${response.status} ${response.statusText}`);
    }

    return await response.json() as OpenWeatherMapForecastResponse;
}

/**
 * Format weather information into a human-readable string
 */
function formatWeatherResponse(currentWeather: OpenWeatherMapResponse, forecast?: OpenWeatherMapForecastResponse): string {
    const lines: string[] = [];
    const locationName = `${currentWeather.name}, ${currentWeather.sys.country}`;
    lines.push(`Weather for ${locationName}:`);
    lines.push('');

    // Current conditions
    const temp = Math.round(currentWeather.main.temp);
    const feelsLike = Math.round(currentWeather.main.feels_like);
    const description = currentWeather.weather[0].description;
    const humidity = currentWeather.main.humidity;
    const windSpeed = Math.round(currentWeather.wind.speed); // Imperial units give mph directly
    const pressure = currentWeather.main.pressure;

    lines.push("🌤️ Current Conditions:");
    lines.push(`  Temperature: ${temp}°F (feels like ${feelsLike}°F)`);
    lines.push(`  Conditions: ${description.charAt(0).toUpperCase() + description.slice(1)}`);
    lines.push(`  Humidity: ${humidity}%`);
    lines.push(`  Wind: ${windSpeed} mph`);
    lines.push(`  Pressure: ${pressure} hPa`);
    lines.push(`  Updated: ${new Date(currentWeather.dt * 1000).toLocaleString()}`);

    // Forecast if available
    if (forecast && forecast.list.length > 0) {
        lines.push('');
        lines.push("📅 3-Day Forecast:");

        // Group forecast data by day
        const dailyData: { [key: string]: { high: number; low: number; conditions: string[] } } = {};

        forecast.list.forEach(item => {
            const date = new Date(item.dt * 1000).toDateString();
            if (!dailyData[date]) {
                dailyData[date] = {
                    high: item.main.temp_max,
                    low: item.main.temp_min,
                    conditions: []
                };
            }
            dailyData[date].high = Math.max(dailyData[date].high, item.main.temp_max);
            dailyData[date].low = Math.min(dailyData[date].low, item.main.temp_min);
            dailyData[date].conditions.push(item.weather[0].description);
        });

        // Display first 3 days
        const days = Object.keys(dailyData).slice(0, 3);
        days.forEach(date => {
            const data = dailyData[date];
            const high = Math.round(data.high);
            const low = Math.round(data.low);
            // Get most common condition
            const mostCommonCondition = data.conditions.sort((a, b) =>
                data.conditions.filter(v => v === a).length - data.conditions.filter(v => v === b).length
            ).pop();

            lines.push(`  ${new Date(date).toLocaleDateString()}: ${mostCommonCondition}, High: ${high}°F, Low: ${low}°F`);
        });
    }

    return lines.join('\n');
}

/**
 * Weather tool that fetches current weather and forecast data
 */
const WeatherTool = new DynamicTool({
    name: "get_weather",
    description: `Get current weather conditions and forecast for any location worldwide.

Returns detailed weather data. After calling this tool, provide a brief response based on what the user asked for:
- For general inquiries ("how's the weather?"): ONLY say "It's [temperature] and [condition]" - DO NOT include humidity, wind, pressure, feels-like, or forecast
- For specific requests: Include only the specific details requested

For US locations, use format "City, State, US" (e.g. "Aurora, Illinois, US").
For other locations, use "City, Country" (e.g. "Paris, France").`,
    func: async (input: string) => {
        try {
            console.log('Weather tool called with input:', input);
            const location = input.trim();

            // Check API key first
            const apiKey = process.env.OPENWEATHERMAP_API_KEY;
            console.log('API key present:', !!apiKey);

            if (!apiKey) {
                const errorMsg = 'OPENWEATHERMAP_API_KEY environment variable is required';
                console.log('Error:', errorMsg);
                return errorMsg;
            }

            console.log('Fetching weather for:', location);

            // Get current weather and forecast
            const [currentWeather, forecast] = await Promise.all([
                getCurrentWeather(location),
                getForecast(location).catch(() => null) // Forecast is optional
            ]);

            console.log('Weather data received, formatting response');

            // Format and return the response
            const result = formatWeatherResponse(currentWeather, forecast || undefined);
            console.log('Formatted response length:', result.length);
            return result;

        } catch (error) {
            console.log('Weather tool error:', error);
            if (error instanceof Error) {
                const errorMsg = `Weather lookup failed: ${error.message}`;
                console.log('Returning error message:', errorMsg);
                return errorMsg;
            }
            const unknownError = "Weather lookup failed: Unknown error occurred";
            console.log('Returning unknown error:', unknownError);
            return unknownError;
        }
    }
});

export default WeatherTool;