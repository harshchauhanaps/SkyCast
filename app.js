const weatherUrl = "https://api.open-meteo.com/v1/forecast";
const cityUrl = "https://geocoding-api.open-meteo.com/v1/search";

let temperatureUnit = "celsius";
let currentCityName = "New Delhi, India";
let currentPlace = {
  name: "New Delhi",
  admin1: "Delhi",
  country: "India",
  latitude: 28.6139,
  longitude: 77.2090
};

function getElement(id) {
  return document.getElementById(id);
}

function setText(id, text) {
  const element = getElement(id);
  if (element) element.textContent = text;
}

function showError(message) {
  const errorBox = getElement("errorMessage");
  if (errorBox) {
    errorBox.textContent = message;
    errorBox.hidden = false;
  }
}

function clearError() {
  const errorBox = getElement("errorMessage");
  if (errorBox) errorBox.hidden = true;
}

function getWeather(code, isDay) {
  const weatherTypes = {
    0: ["☀️", "Clear sky"],
    1: ["🌤️", "Mostly clear"],
    2: ["⛅", "Partly cloudy"],
    3: ["☁️", "Cloudy"],
    45: ["🌫️", "Fog"],
    48: ["🌫️", "Fog"],
    51: ["🌦️", "Drizzle"],
    53: ["🌦️", "Drizzle"],
    55: ["🌧️", "Heavy drizzle"],
    61: ["🌧️", "Light rain"],
    63: ["🌧️", "Rain"],
    65: ["🌧️", "Heavy rain"],
    71: ["❄️", "Light snow"],
    73: ["❄️", "Snow"],
    75: ["❄️", "Heavy snow"],
    80: ["🌦️", "Rain showers"],
    81: ["🌧️", "Rain showers"],
    82: ["🌧️", "Heavy showers"],
    95: ["⛈️", "Thunderstorm"],
    96: ["⛈️", "Thunderstorm"],
    99: ["⛈️", "Thunderstorm"]
  };

  const result = weatherTypes[code] || ["🌥️", "Changing weather"];
  if (!isDay && code === 0) return ["🌙", result[1]];
  return result;
}

async function searchCity(cityName) {
  const name = cityName.trim();
  if (!name) return;

  clearError();
  setText("statusLine", "Searching for " + name + "...");

  try {
    const searchParams = new URLSearchParams({
      name: name,
      count: "1",
      language: "en"
    });

    const response = await fetch(cityUrl + "?" + searchParams);
    if (!response.ok) throw new Error("City search did not work. Please try again.");

    const result = await response.json();
    if (!result.results || result.results.length === 0) {
      throw new Error("City not found. Try adding the country name.");
    }

    currentPlace = result.results[0];
    currentCityName = currentPlace.name + ", " + (currentPlace.country || "");
    await loadWeather(currentPlace, currentCityName);
  } catch (error) {
    setText("statusLine", "Search could not be completed.");
    showError(error.message);
  }
}

async function loadWeather(place, cityName) {
  clearError();
  setText("statusLine", "Loading weather...");

  try {
    const weatherParams = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m,wind_direction_10m",
      hourly: "temperature_2m,precipitation_probability,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,uv_index_max",
      temperature_unit: temperatureUnit,
      wind_speed_unit: temperatureUnit === "celsius" ? "kmh" : "mph",
      timezone: "auto",
      forecast_days: "7"
    });

    const response = await fetch(weatherUrl + "?" + weatherParams);
    if (!response.ok) throw new Error("Weather could not be loaded. Please try again.");

    const data = await response.json();
    if (data.error) throw new Error(data.reason || "The weather service returned an error.");

    showWeather(place, cityName, data);
    setText("statusLine", "Latest weather for " + cityName);
    setActiveCity(place.name);
  } catch (error) {
    setText("statusLine", "Weather could not be refreshed.");
    showError(error.message);
  }
}

function showWeather(place, cityName, data) {
  const now = data.current;
  const today = data.daily;
  const description = getWeather(now.weather_code, now.is_day);
  const locationParts = [place.admin1, place.country].filter(Boolean);

  setText("locationName", place.name || "Your location");
  setText("locationDetail", locationParts.join(", ") || cityName);
  setText("currentTemperature", Math.round(now.temperature_2m) + "°");
  setText("currentCondition", description[1]);
  setText("heroIcon", description[0]);
  setText("heroCaption", description[1]);
  setText("highLow", "High: " + Math.round(today.temperature_2m_max[0]) + "° · Low: " + Math.round(today.temperature_2m_min[0]) + "°");
  setText("updatedAt", "Updated " + new Date(now.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  setText("feelsLike", Math.round(now.apparent_temperature) + "°");
  setText("feelsNote", "How the temperature feels outside");
  setText("humidity", Math.round(now.relative_humidity_2m) + "%");
  setText("windSpeed", Math.round(now.wind_speed_10m) + " " + (temperatureUnit === "celsius" ? "km/h" : "mph"));

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const direction = directions[Math.round(now.wind_direction_10m / 45) % 8];
  setText("windDirection", direction + " wind");

  const uv = Number(today.uv_index_max[0]);
  setText("uvIndex", uv.toFixed(1));
  setText("uvNote", uv >= 6 ? "High today" : "Today's peak");
  setText("todayLabel", new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }).toUpperCase());

  showHourly(data);
  showDaily(today);
}

function showHourly(data) {
  const hourly = data.hourly;
  const currentTime = new Date(data.current.time).getTime();
  let firstHour = hourly.time.findIndex((time) => new Date(time).getTime() >= currentTime);
  if (firstHour < 0) firstHour = 0;

  let cards = "";
  for (let step = 0; step < 8; step++) {
    const index = firstHour + step;
    if (index >= hourly.time.length) break;

    const time = step === 0
      ? "Now"
      : new Date(hourly.time[index]).toLocaleTimeString([], { hour: "numeric" });
    const icon = getWeather(hourly.weather_code[index], true)[0];
    const rain = Math.round(hourly.precipitation_probability[index] || 0);

    cards += '<div class="hour-card' + (step === 0 ? " is-now" : "") + '">';
    cards += '<span class="hour-time">' + time + '</span>';
    cards += '<span class="hour-icon">' + icon + '</span>';
    cards += '<strong class="hour-temp">' + Math.round(hourly.temperature_2m[index]) + '°</strong>';
    cards += '<span class="hour-rain">' + rain + '% rain</span>';
    cards += '</div>';
  }

  const list = getElement("hourlyList");
  if (list) list.innerHTML = cards;
}

function showDaily(days) {
  let rows = "";

  for (let index = 0; index < days.time.length; index++) {
    let dayName = new Date(days.time[index] + "T12:00:00")
      .toLocaleDateString([], { weekday: "short" });
    if (index === 0) dayName = "Today";
    if (index === 1) dayName = "Tomorrow";

    const icon = getWeather(days.weather_code[index], true)[0];
    const high = Math.round(days.temperature_2m_max[index]);
    const low = Math.round(days.temperature_2m_min[index]);
    const uv = Number(days.uv_index_max[index]).toFixed(1);

    rows += '<div class="day-row">';
    rows += '<span class="day-name">' + dayName + '</span>';
    rows += '<span class="day-condition"><span class="day-icon">' + icon + '</span>' + getWeather(days.weather_code[index], true)[1] + '</span>';
    rows += '<span class="day-rain">UV ' + uv + '</span>';
    rows += '<span class="day-range">' + high + '° <span class="low">' + low + '°</span></span>';
    rows += '</div>';
  }

  const list = getElement("dailyList");
  if (list) list.innerHTML = rows;
}

function setActiveCity(cityName) {
  document.querySelectorAll(".place-button").forEach((button) => {
    const isActive = button.dataset.city.toLowerCase().startsWith(cityName.toLowerCase());
    button.classList.toggle("is-active", isActive);
  });
}

document.getElementById("searchForm").addEventListener("submit", function (event) {
  event.preventDefault();
  searchCity(document.getElementById("citySearch").value);
});

document.querySelectorAll(".place-button").forEach((button) => {
  button.addEventListener("click", function () {
    searchCity(button.dataset.city);
  });
});

document.querySelectorAll(".unit-button").forEach((button) => {
  button.addEventListener("click", function () {
    temperatureUnit = button.dataset.unit;

    document.querySelectorAll(".unit-button").forEach((unitButton) => {
      const selected = unitButton.dataset.unit === temperatureUnit;
      unitButton.classList.toggle("is-selected", selected);
      unitButton.setAttribute("aria-pressed", selected);
    });

    loadWeather(currentPlace, currentCityName);
  });
});

document.getElementById("locationButton").addEventListener("click", function () {
  if (!navigator.geolocation) {
    showError("Location is not available in this browser. Search for a city instead.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function (position) {
      currentPlace = {
        name: "Your location",
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      currentCityName = "Your location";
      loadWeather(currentPlace, currentCityName);
    },
    function () {
      showError("Location access was not allowed. Search for a city instead.");
    }
  );
});

loadWeather(currentPlace, currentCityName);
