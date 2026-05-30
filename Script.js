 const API_KEY = 'bd5e378503939ddaee76f12ad7a97608'; // Demo key (openweathermap)
  let currentUnit = 'metric';
  let currentCity = '';

  const $ = id => document.getElementById(id);

  function setError(msg) {
    const el = $('error-msg');
    el.textContent = msg;
    el.classList.toggle('visible', !!msg);
  }

  function setLoader(show) {
    $('loader').classList.toggle('visible', show);
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    const data = await res.json();
    // OpenWeather API returns cod as string, convert to number for comparison
    if (data.cod !== undefined && parseInt(data.cod) !== 200) {
      throw new Error(data.message || 'Failed to fetch weather data');
    }
    return data;
  }

  function geoPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported by your browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, error => reject(error), { enableHighAccuracy: true, timeout: 10000 });
    });
  }

  function switchUnit(unit) {
    if (unit === currentUnit) return;
    currentUnit = unit;
    $('btn-c').classList.toggle('active', unit === 'metric');
    $('btn-f').classList.toggle('active', unit === 'imperial');
    if (currentCity) fetchWeather(currentCity);
  }

  async function searchWeather() {
    const city = $('city-input').value.trim();
    if (!city) { setError('Please enter a city name.'); return; }
    await fetchWeather(city);
  }

  function clearSearch() {
    const input = $('city-input');
    input.value = '';
    $('clear-btn').classList.add('hidden');
    input.focus();
  }

  async function getLocation() {
    setLoader(true);
    setError('');
    try {
      const position = await geoPosition();
      await fetchByCoords(position.coords.latitude, position.coords.longitude);
    } catch (error) {
      setError(error.code === 1 ? 'Location access denied. Please search manually.' : error.message);
      $('empty-state').style.display = 'block';
      setLoader(false);
    }
  }

  async function fetchByCoords(lat, lon) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=${currentUnit}`;
      const data = await fetchJson(url);
      renderWeather(data);
    } catch(e) {
      setError('Could not fetch weather. Try searching by city.');
      $('empty-state').style.display = 'block';
    } finally {
      setLoader(false);
    }
  }

  async function fetchWeather(city) {
    setLoader(true);
    setError('');
    $('weather-result').classList.remove('visible');
    $('empty-state').style.display = 'none';
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${API_KEY}&units=${currentUnit}`;
      const data = await fetchJson(url);
      currentCity = city;
      renderWeather(data);
    } catch(e) {
      setError(e.message.charAt(0).toUpperCase() + e.message.slice(1) + '. Try another city.');
      $('empty-state').style.display = 'block';
    } finally {
      setLoader(false);
    }
  }

  async function fetchForecastData(lat, lon) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`;
      const data = await fetchJson(url);
      const byDate = {};

      data.list.forEach(item => {
        const date = new Date(item.dt * 1000);
        const dayKey = date.toISOString().slice(0, 10);
        if (!byDate[dayKey]) {
          byDate[dayKey] = {
            date,
            temps: [],
            icons: [],
            descriptions: [],
            items: [],
          };
        }
        byDate[dayKey].temps.push(item.main.temp_min, item.main.temp_max);
        byDate[dayKey].icons.push({ id: item.weather[0].id, pod: item.weather[0].icon.slice(-1) });
        byDate[dayKey].descriptions.push(item.weather[0].description);
        byDate[dayKey].items.push(item);
      });

      const days = Object.values(byDate)
        .sort((a, b) => a.date - b.date)
        .slice(0, 5)
        .map(day => {
          const temps = day.temps;
          const icon = day.items[Math.floor(day.items.length / 2)]?.weather[0] || day.items[0].weather[0];
          const description = day.descriptions[Math.floor(day.descriptions.length / 2)] || day.descriptions[0];
          return {
            dt: Math.floor(day.date.getTime() / 1000),
            temp: {
              min: Math.min(...temps),
              max: Math.max(...temps),
            },
            weather: [{ id: icon.id, icon: icon.icon, description }],
          };
        });

      $('uv').textContent = '—';
      $('forecast-units').textContent = currentUnit === 'metric' ? '°C' : '°F';
      renderForecast(days);
    } catch (error) {
      console.warn('Forecast fetch failed:', error);
      $('forecast-grid').innerHTML = '<div class="forecast-empty">Forecast unavailable.</div>';
    }
  }

  function renderForecast(days) {
    const unit = currentUnit === 'metric' ? '°C' : '°F';
    const grid = $('forecast-grid');
    if (!days || !days.length) {
      grid.innerHTML = '<div class="forecast-empty">Forecast unavailable.</div>';
      return;
    }

    grid.innerHTML = days.map(day => {
      const date = new Date(day.dt * 1000);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const icon = weatherIcon(day.weather[0].id, day.weather[0].icon.slice(-1));
      return `
        <div class="forecast-day">
          <div class="day">${dayName}</div>
          <div class="icon">${icon}</div>
          <div class="temp">${Math.round(day.temp.max)}${unit}
            <span>${Math.round(day.temp.min)}${unit}</span>
          </div>
          <div class="description">${day.weather[0].description}</div>
        </div>`;
    }).join('');
  }

  function weatherIcon(id, pod) {
    if (id >= 200 && id < 300) return '⛈️';
    if (id >= 300 && id < 400) return '🌦️';
    if (id >= 500 && id < 600) {
      if (id === 511) return '🌨️';
      return id < 502 ? '🌧️' : '⛈️';
    }
    if (id >= 600 && id < 700) return id === 611 ? '🌨️' : '❄️';
    if (id >= 700 && id < 800) {
      if (id === 741) return '🌫️';
      if (id === 781) return '🌪️';
      return '🌫️';
    }
    if (id === 800) return pod === 'd' ? '☀️' : '🌙';
    if (id === 801) return pod === 'd' ? '🌤️' : '🌙';
    if (id === 802) return '⛅';
    if (id === 803 || id === 804) return '☁️';
    return '🌡️';
  }

  function uvLabel(uv) {
    if (uv === undefined) return 'N/A';
    if (uv <= 2) return `${uv} Low`;
    if (uv <= 5) return `${uv} Mod`;
    if (uv <= 7) return `${uv} High`;
    if (uv <= 10) return `${uv} V.High`;
    return `${uv} Extreme`;
  }

  function renderWeather(d) {
    currentCity = d.name;
    const unit = currentUnit === 'metric' ? '°C' : '°F';
    const unitLabel = currentUnit === 'metric' ? '°C' : '°F';
    const windU = currentUnit === 'metric' ? 'm/s' : 'mph';

    $('city-name').textContent = d.name;
    $('country-date').textContent = `${d.sys.country} · ${new Date().toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'})}`;
    $('temperature').innerHTML = `${Math.round(d.main.temp)}<sup>°</sup>`;
    $('feels-like').textContent = `Feels like ${Math.round(d.main.feels_like)}${unit}`;
    $('condition').textContent = d.weather[0].description;
    $('weather-icon').textContent = weatherIcon(d.weather[0].id, d.weather[0].icon.slice(-1));

    $('humidity').innerHTML = `${d.main.humidity}<span class="stat-unit"> %</span>`;
    $('wind').innerHTML = `${d.wind.speed}<span class="stat-unit" id="wind-unit"> ${windU}</span>`;
    $('clouds').innerHTML = `${d.clouds.all}<span class="stat-unit"> %</span>`;
    $('uv').textContent = '—';

    const minT = Math.round(d.main.temp_min);
    const maxT = Math.round(d.main.temp_max);
    $('temp-min').textContent = `${minT}${unit}`;
    $('temp-max').textContent = `${maxT}${unit}`;

    // Range bar fill (relative to expected full range)
    const absMin = currentUnit === 'metric' ? -10 : 14;
    const absMax = currentUnit === 'metric' ? 45 : 113;
    const fillPct = ((maxT - absMin) / (absMax - absMin)) * 100;
    setTimeout(() => { $('range-fill').style.width = Math.min(100, Math.max(5, fillPct)) + '%'; }, 100);

    $('visibility').textContent = d.visibility ? `${(d.visibility / 1000).toFixed(1)} km` : 'N/A';
    $('pressure').textContent = `${d.main.pressure} hPa`;

    $('weather-result').classList.add('visible');
    if (d.coord) {
      fetchForecastData(d.coord.lat, d.coord.lon);
    }
  }

  // Enter key
  $('city-input').addEventListener('keydown', e => { if (e.key === 'Enter') searchWeather(); });
  $('city-input').addEventListener('input', () => {
    $('clear-btn').classList.toggle('hidden', !$('city-input').value.trim());
  });
  $('clear-btn').addEventListener('click', clearSearch);
