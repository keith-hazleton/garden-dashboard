const db = require('../models/db');
const { getDisplayName } = require('./sensorNames');

const CACHE_DURATION_MINUTES = 15;

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

// Generate watering advice data (shared between API route and cron notification)
async function getWateringAdvice() {
  const lat = process.env.GARDEN_LAT;
  const lon = process.env.GARDEN_LON;

  // Get current soil moisture readings
  const sensorReadings = db.prepare(`
    SELECT sensor_id, sensor_name, moisture_percent
    FROM sensor_readings
    WHERE sensor_type = 'moisture'
      AND id IN (
        SELECT MAX(id) FROM sensor_readings WHERE sensor_type = 'moisture' GROUP BY sensor_id
      )
  `).all();

  // Get forecast for next 3 days
  let forecastData = getCachedData('forecast');
  if (!forecastData) {
    const data = await fetchOpenMeteo('forecast', {
      latitude: lat,
      longitude: lon,
      daily: 'precipitation_sum,precipitation_probability_max,temperature_2m_max',
      temperature_unit: 'fahrenheit',
      precipitation_unit: 'inch',
      timezone: 'auto',
      models: 'gfs_seamless'
    });

    forecastData = {
      forecast: data.daily.time.slice(0, 3).map((date, i) => ({
        date,
        precipitation: data.daily.precipitation_sum[i],
        precipitation_probability: data.daily.precipitation_probability_max[i],
        temp_high: data.daily.temperature_2m_max[i]
      }))
    };
  } else {
    forecastData.forecast = forecastData.forecast.slice(0, 3);
  }

  // Calculate per-sensor recommendations
  const recommendations = [];

  for (const sensor of sensorReadings) {
    const moisture = sensor.moisture_percent;
    let status = 'ok';
    let advice = '';

    if (moisture < 20) {
      status = 'critical';
      advice = 'Water immediately - soil is very dry';
    } else if (moisture < 35) {
      status = 'low';
      advice = 'Consider watering soon';
    } else if (moisture > 70) {
      status = 'saturated';
      advice = 'Soil is very wet - no watering needed';
    } else {
      status = 'good';
      advice = 'Moisture levels are adequate';
    }

    recommendations.push({
      sensor_id: sensor.sensor_id,
      sensor_name: sensor.sensor_name,
      display_name: getDisplayName(sensor.sensor_id, sensor.sensor_name),
      moisture_percent: moisture,
      status,
      advice
    });
  }

  // Check upcoming rain
  const upcomingRain = forecastData.forecast.reduce((total, day) => total + (day.precipitation || 0), 0);
  const todayRain = forecastData.forecast[0]?.precipitation || 0;
  const todayRainProbability = forecastData.forecast[0]?.precipitation_probability || 0;
  const rainExpectedToday = todayRain > 0.1 || todayRainProbability > 50;
  const rainProbability = Math.max(...forecastData.forecast.map(d => d.precipitation_probability || 0));

  // Check for high temps
  const maxTemp = Math.max(...forecastData.forecast.map(d => d.temp_high || 0));

  // Check if any sensor is critically dry
  const hasCritical = recommendations.some(r => r.status === 'critical');

  let overallAdvice = '';

  if (hasCritical && !rainExpectedToday) {
    overallAdvice = 'Soil is critically dry and rain is not expected today. Water now.';
  } else if (upcomingRain > 2) {
    overallAdvice = `Heavy rain expected in the next 3 days (${upcomingRain.toFixed(2)}" total). Do not water.`;
  } else if (upcomingRain > 0.5 || rainProbability > 60) {
    overallAdvice = `Rain expected in the next 3 days (${upcomingRain.toFixed(2)}" total, ${rainProbability}% chance). Hold off on watering.`;
  } else if (maxTemp > 95) {
    overallAdvice = `High temperatures expected (${maxTemp}°F). Plants may need extra water, especially in containers.`;
  } else if (maxTemp > 85) {
    overallAdvice = 'Warm weather ahead. Monitor soil moisture and water in the morning if needed.';
  } else {
    overallAdvice = 'Weather conditions are moderate. Water based on soil moisture readings.';
  }

  return {
    sensors: recommendations,
    forecast_summary: {
      days_checked: 3,
      total_expected_rain: upcomingRain,
      max_rain_probability: rainProbability,
      max_temperature: maxTemp
    },
    overall_advice: overallAdvice
  };
}

module.exports = { getWateringAdvice };
