const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { getDisplayName } = require('../services/sensorNames');
const { getWateringAdvice } = require('../services/wateringAdvice');
const { getSetting } = require('../services/alerts');

// Resolve garden coordinates: DB settings first, then env vars
function getCoordinates() {
  const lat = getSetting('garden_lat') || process.env.GARDEN_LAT;
  const lon = getSetting('garden_lon') || process.env.GARDEN_LON;
  return { lat, lon };
}

const CACHE_DURATION_MINUTES = 15;

// Helper to check if cache is still valid
function getCachedData(dataType) {
  const cached = db.prepare(`
    SELECT data, fetched_at FROM weather_cache
    WHERE data_type = ?
    ORDER BY fetched_at DESC LIMIT 1
  `).get(dataType);

  if (!cached) return null;

  const fetchedAt = new Date(cached.fetched_at.replace(' ', 'T') + 'Z');
  const now = new Date();
  const minutesOld = (now - fetchedAt) / (1000 * 60);

  if (minutesOld < CACHE_DURATION_MINUTES) {
    return JSON.parse(cached.data);
  }

  return null;
}

// Helper to cache data
function cacheData(dataType, data) {
  // Delete old cache entries for this type
  db.prepare('DELETE FROM weather_cache WHERE data_type = ?').run(dataType);

  // Insert new cache entry
  db.prepare(`
    INSERT INTO weather_cache (data_type, data) VALUES (?, ?)
  `).run(dataType, JSON.stringify(data));
}

// Fetch from Open-Meteo API
async function fetchOpenMeteo(endpoint, params) {
  const url = new URL(`https://api.open-meteo.com/v1/${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Open-Meteo API error: ${response.status}`);
  }

  return response.json();
}

// Get current weather conditions
router.get('/current', async (req, res) => {
  try {
    const coords = getCoordinates();
    const lat = req.query.lat || coords.lat;
    const lon = req.query.lon || coords.lon;

    // Check cache first
    const cached = getCachedData('current');
    if (cached) {
      return res.json(cached);
    }

    const data = await fetchOpenMeteo('forecast', {
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto'
    });

    const result = {
      temperature: data.current.temperature_2m,
      feels_like: data.current.apparent_temperature,
      humidity: data.current.relative_humidity_2m,
      precipitation: data.current.precipitation,
      weather_code: data.current.weather_code,
      weather_description: getWeatherDescription(data.current.weather_code),
      wind_speed: data.current.wind_speed_10m,
      wind_direction: data.current.wind_direction_10m,
      time: data.current.time,
      timezone: data.timezone
    };

    cacheData('current', result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching current weather:', error);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
});

// Get forecast (7-day)
router.get('/forecast', async (req, res) => {
  try {
    const coords = getCoordinates();
    const lat = req.query.lat || coords.lat;
    const lon = req.query.lon || coords.lon;

    // Check cache first
    const cached = getCachedData('forecast');
    if (cached) {
      return res.json(cached);
    }

    const data = await fetchOpenMeteo('forecast', {
      latitude: lat,
      longitude: lon,
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
      timezone: 'auto',
      models: 'gfs_seamless'
    });

    const forecast = data.daily.time.map((date, i) => ({
      date,
      weather_code: data.daily.weather_code[i],
      weather_description: getWeatherDescription(data.daily.weather_code[i]),
      temp_high: data.daily.temperature_2m_max[i],
      temp_low: data.daily.temperature_2m_min[i],
      precipitation: data.daily.precipitation_sum[i],
      precipitation_probability: data.daily.precipitation_probability_max[i],
      wind_speed_max: data.daily.wind_speed_10m_max[i]
    }));

    const result = { forecast, timezone: data.timezone };
    cacheData('forecast', result);
    res.json(result);
  } catch (error) {
    console.error('Error fetching forecast:', error);
    res.status(500).json({ error: 'Failed to fetch forecast data' });
  }
});

// Get watering recommendation based on weather + soil moisture
router.get('/watering-advice', async (req, res) => {
  try {
    const advice = await getWateringAdvice();
    res.json(advice);
  } catch (error) {
    console.error('Error generating watering advice:', error);
    res.status(500).json({ error: 'Failed to generate watering advice' });
  }
});

// WMO Weather interpretation codes
function getWeatherDescription(code) {
  const descriptions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail'
  };

  return descriptions[code] || 'Unknown';
}

module.exports = router;
