/* ==========================================================================
   api.js — data layer. Exposed as window.WXApi.
   Live data comes from Open-Meteo (no API key). When the network is
   unavailable a deterministic local model produces a plausible forecast so
   the dashboard never renders empty.
   ========================================================================== */
(function (global) {
  'use strict';

  var FORECAST = 'https://api.open-meteo.com/v1/forecast';
  var AIR = 'https://air-quality-api.open-meteo.com/v1/air-quality';
  var GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  var TIMEOUT = 12000;
  var CACHE_KEY = 'skylight.cache.v1';
  var PLACE_KEY = 'skylight.place.v1';
  var TTL = 15 * 60 * 1000;

  var HOURLY_FIELDS = [
    'temperature_2m', 'apparent_temperature', 'precipitation_probability', 'precipitation',
    'weather_code', 'wind_speed_10m', 'wind_direction_10m', 'relative_humidity_2m',
    'is_day', 'uv_index', 'visibility', 'dew_point_2m', 'cloud_cover', 'pressure_msl'
  ].join(',');

  var CURRENT_FIELDS = [
    'temperature_2m', 'relative_humidity_2m', 'apparent_temperature', 'is_day',
    'precipitation', 'weather_code', 'cloud_cover', 'pressure_msl',
    'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'
  ].join(',');

  var DAILY_FIELDS = [
    'weather_code', 'temperature_2m_max', 'temperature_2m_min', 'sunrise', 'sunset',
    'uv_index_max', 'precipitation_sum', 'precipitation_probability_max',
    'wind_speed_10m_max', 'wind_direction_10m_dominant'
  ].join(',');

  /* ── small utils ──────────────────────────────────────────────────── */
  function qs(params) {
    return Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
  }
  function getJSON(url) {
    var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, TIMEOUT);
    return fetch(url, { signal: ctl ? ctl.signal : undefined, mode: 'cors', cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .finally(function () { clearTimeout(timer); });
  }
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ── Solar position (NOAA approximation, good to ~2 min) ──────────── */
  function norm180(deg) {
    var d = ((deg + 180) % 360 + 360) % 360 - 180;
    return d;
  }
  function solar(lat, lon, date) {
    var rad = Math.PI / 180;
    var start = Date.UTC(date.getUTCFullYear(), 0, 0);
    var doy = Math.floor((date.getTime() - start) / 86400000);
    var g = (357.529 + 0.98560028 * doy) * rad;
    var q = (280.459 + 0.98564736 * doy) * rad;
    var L = q + (1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad;
    var e = (23.439 - 0.00000036 * doy) * rad;
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var latR = lat * rad;
    /* Hour angle at sunrise/sunset, including the standard 0.833° correction for
       atmospheric refraction and the radius of the solar disc. Result is in
       degrees; divide by 15 to get hours. */
    var zenith = 90.833 * rad;
    var cosH = (Math.cos(zenith) - Math.sin(latR) * Math.sin(dec)) /
      (Math.cos(latR) * Math.cos(dec));
    var hasSun = cosH > -1 && cosH < 1;
    var H = Math.acos(clamp(cosH, -1, 1)) / rad;
    /* Equation of time in minutes: mean longitude minus right ascension. */
    var eotMin = 4 * norm180(q / rad - ra / rad);
    return {
      decl: dec / rad, hasSun: hasSun,
      halfDay: hasSun ? H / 15 : (cosH <= -1 ? 12 : 0),
      eotMin: eotMin
    };
  }

  /**
   * Absolute epochs of sunrise/sunset for the local day that starts at
   * localMidnightEpoch. Solar noon depends on longitude and the equation of
   * time, not just the timezone, so both are applied explicitly.
   */
  function sunTimes(lat, lon, localMidnightEpoch, offsetSec) {
    var utcMidnight = localMidnightEpoch + (offsetSec || 0) * 1000;
    var s = solar(lat, lon, new Date(utcMidnight + 12 * 3600e3));
    var solarNoonUTC = utcMidnight + 12 * 3600e3 - (lon / 15) * 3600e3 - s.eotMin * 60e3;
    var halfMs = s.halfDay * 3600e3;
    return {
      sunrise: solarNoonUTC - halfMs,
      sunset: solarNoonUTC + halfMs,
      polar: !s.hasSun
    };
  }

  /* ── Local simulation fallback ────────────────────────────────────── */
  function simulate(place, now) {
    var offsetSec = place.utcOffsetSeconds != null ? place.utcOffsetSeconds
      : -Math.round((new Date(now).getTimezoneOffset()) * 60);
    var dayMs = 86400000;
    var localMidnight = Math.floor((now + offsetSec * 1000) / dayMs) * dayMs - offsetSec * 1000;
    var r = rng(hash(place.name + '|' + place.latitude.toFixed(2) + '|' + place.longitude.toFixed(2)));
    var absLat = Math.abs(place.latitude);
    var isSouth = place.latitude < 0;
    var d = new Date(now);
    var doy = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 0)) / dayMs);

    /* Seasonal baseline: warm near the summer solstice for each hemisphere. */
    var seasonal = Math.cos(((doy - (isSouth ? 355 : 172)) / 365) * 2 * Math.PI);
    var annualMean = 29 - absLat * 0.42;
    var annualSwing = 6 + absLat * 0.22;
    var base = annualMean + seasonal * annualSwing;

    /* Weather regime for this simulated run. */
    var wetness = r();
    var regime = wetness < .30 ? 'clear' : wetness < .58 ? 'partly' : wetness < .78 ? 'cloudy' : wetness < .90 ? 'rain' : wetness < .96 ? 'showers' : 'storm';
    var codeFor = { clear: [0, 1], partly: [2, 1], cloudy: [3, 2], rain: [61, 63, 51], showers: [80, 81], storm: [95, 96] }[regime];
    var code = codeFor[Math.floor(r() * codeFor.length)];

    var today = sunTimes(place.latitude, place.longitude, localMidnight, offsetSec);

    function hourIndex(epoch) { return Math.round((epoch - localMidnight) / 3600e3); }
    function diurnal(epoch) {
      var solarNoon = localMidnight + 12 * 3600e3 - offsetSec * 1000;
      var x = ((epoch - solarNoon) / 86400e3) * 2 * Math.PI;
      return -Math.cos(x);
    }
    function isDayAt(epoch) {
      if (today.polar) return solar(place.latitude, place.longitude, new Date(epoch)).altitude > 0;
      return epoch >= today.sunrise && epoch <= today.sunset;
    }
    function tempAt(epoch) {
      var amp = 4.4 + r() * 1.6;
      var noise = Math.sin(epoch / 3600e3 * 0.7 + hash(place.name) % 7) * 0.7;
      return base + diurnal(epoch) * amp + noise;
    }
    function codeAt(epoch, i) {
      if (regime === 'clear' || regime === 'partly') {
        var night = !isDayAt(epoch);
        return night ? code : code;
      }
      /* Fronts move through: vary the code across the window. */
      var phase = Math.sin(i / 9 + r());
      return phase > 0.45 ? code : codeFor[0];
    }
    function popAt(epoch, i) {
      if (regime === 'clear') return Math.round(r() * 6);
      if (regime === 'partly') return Math.round(6 + r() * 14);
      if (regime === 'cloudy') return Math.round(12 + r() * 20);
      if (regime === 'rain') return Math.round(52 + Math.sin(i / 5) * 22 + r() * 10);
      if (regime === 'showers') return Math.round(45 + Math.sin(i / 4) * 28 + r() * 12);
      return Math.round(60 + Math.sin(i / 6) * 25 + r() * 12);
    }

    var hourly = { time: [], temperature_2m: [], apparent_temperature: [], precipitation_probability: [],
      precipitation: [], weather_code: [], wind_speed_10m: [], wind_direction_10m: [],
      relative_humidity_2m: [], is_day: [], uv_index: [], visibility: [], dew_point_2m: [],
      cloud_cover: [], pressure_msl: [] };
    var daily = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [],
      sunrise: [], sunset: [], uv_index_max: [], precipitation_sum: [],
      precipitation_probability_max: [], wind_speed_10m_max: [], wind_direction_10m_dominant: [] };

    function isoLocal(epoch) {
      var w = new Date(epoch + offsetSec * 1000);
      function p(n) { return (n < 10 ? '0' : '') + n; }
      return w.getUTCFullYear() + '-' + p(w.getUTCMonth() + 1) + '-' + p(w.getUTCDate()) + 'T' +
        p(w.getUTCHours()) + ':' + p(w.getUTCMinutes());
    }

    for (var h = 0; h < 72; h++) {
      var ep = localMidnight + h * 3600e3;
      var t = tempAt(ep);
      var c = codeAt(ep, h);
      var pop = clamp(popAt(ep, h), 0, 100);
      var day = isDayAt(ep);
      var rh = clamp(52 + (regime === 'clear' ? -14 : 12) + Math.sin(h / 5) * 9 + (1 - diurnal(ep)) * 12 + r() * 5, 18, 99);
      var wind = clamp(6 + r() * 14 + (regime === 'storm' ? 22 : 0) + Math.sin(h / 7) * 5, 1, 95);
      hourly.time.push(isoLocal(ep));
      hourly.temperature_2m.push(+t.toFixed(1));
      hourly.apparent_temperature.push(+(t - (wind > 20 ? 1.6 : 0) + (rh > 80 ? 1.2 : 0)).toFixed(1));
      hourly.precipitation_probability.push(pop);
      hourly.precipitation.push(+(pop > 45 ? (pop / 100) * 1.6 * r() : 0).toFixed(2));
      hourly.weather_code.push(c);
      hourly.wind_speed_10m.push(+wind.toFixed(1));
      hourly.wind_direction_10m.push(Math.round((r() * 360)));
      hourly.relative_humidity_2m.push(Math.round(rh));
      hourly.is_day.push(day ? 1 : 0);
      hourly.uv_index.push(+Math.max(0, (day ? Math.sin(Math.PI * clamp((ep - today.sunrise) / (today.sunset - today.sunrise), 0, 1)) : 0) * (9 - absLat * 0.06) * (regime === 'clear' ? 1 : regime === 'partly' ? .8 : .35)).toFixed(1));
      hourly.visibility.push(Math.round(regime === 'clear' ? 24000 + r() * 16000 : regime === 'cloudy' ? 14000 + r() * 9000 : 4000 + r() * 9000));
      hourly.dew_point_2m.push(+global.WX.dewPoint(t, rh).toFixed(1));
      hourly.cloud_cover.push(Math.round(regime === 'clear' ? r() * 12 : regime === 'partly' ? 25 + r() * 35 : 70 + r() * 30));
      hourly.pressure_msl.push(+(1013 + (regime === 'storm' ? -14 : regime === 'rain' ? -7 : 4) +
        Math.sin((h + doy) / 9) * 4 + r() * 1.2 - .6).toFixed(1));
    }

    for (var dd = 0; dd < 7; dd++) {
      var mid = localMidnight + dd * dayMs;
      var st = sunTimes(place.latitude, place.longitude, mid, offsetSec);
      var lo = Infinity, hi = -Infinity, popMax = 0, precipSum = 0, windMax = 0, uvMax = 0;
      for (var hh = 0; hh < 24; hh++) {
        var e2 = mid + hh * 3600e3;
        var t2 = tempAt(e2) + dd * (r() - .5) * 1.6;
        lo = Math.min(lo, t2); hi = Math.max(hi, t2);
        var p2 = popAt(e2, hh + dd * 24);
        popMax = Math.max(popMax, p2);
        if (p2 > 45) precipSum += (p2 / 100) * 1.4 * r();
        windMax = Math.max(windMax, 6 + r() * 16 + (regime === 'storm' ? 20 : 0));
        if (e2 >= st.sunrise && e2 <= st.sunset) {
          uvMax = Math.max(uvMax, Math.sin(Math.PI * (e2 - st.sunrise) / (st.sunset - st.sunrise)) * (9 - absLat * 0.06));
        }
      }
      daily.time.push(isoLocal(mid).slice(0, 10));
      daily.weather_code.push(dd === 0 ? code : codeFor[Math.floor(r() * codeFor.length)]);
      daily.temperature_2m_max.push(+hi.toFixed(1));
      daily.temperature_2m_min.push(+lo.toFixed(1));
      daily.sunrise.push(isoLocal(st.sunrise));
      daily.sunset.push(isoLocal(st.sunset));
      daily.uv_index_max.push(+Math.max(0, uvMax).toFixed(1));
      daily.precipitation_sum.push(+precipSum.toFixed(1));
      daily.precipitation_probability_max.push(Math.round(popMax));
      daily.wind_speed_10m_max.push(+windMax.toFixed(1));
      daily.wind_direction_10m_dominant.push(Math.round(r() * 360));
    }

    var nowIdx = clamp(hourIndex(now), 0, hourly.time.length - 1);
    var current = {
      time: hourly.time[nowIdx],
      temperature_2m: hourly.temperature_2m[nowIdx],
      relative_humidity_2m: hourly.relative_humidity_2m[nowIdx],
      apparent_temperature: hourly.apparent_temperature[nowIdx],
      is_day: hourly.is_day[nowIdx],
      precipitation: hourly.precipitation[nowIdx],
      weather_code: hourly.weather_code[nowIdx],
      cloud_cover: hourly.cloud_cover[nowIdx],
      pressure_msl: hourly.pressure_msl[nowIdx],
      wind_speed_10m: hourly.wind_speed_10m[nowIdx],
      wind_direction_10m: hourly.wind_direction_10m[nowIdx],
      wind_gusts_10m: +(hourly.wind_speed_10m[nowIdx] * 1.7).toFixed(1)
    };

    var aqi = Math.round(regime === 'clear' ? 22 + r() * 30 : regime === 'storm' ? 12 + r() * 20 : 45 + r() * 55);

    return {
      source: 'demo',
      place: place,
      timezone: place.timezone || 'UTC',
      utcOffsetSeconds: offsetSec,
      current: current,
      hourly: hourly,
      daily: daily,
      air: { us_aqi: aqi, pm2_5: +(aqi / 5.2).toFixed(1), pm10: +(aqi / 3.4).toFixed(1), ozone: +(40 + r() * 60).toFixed(0) },
      fetchedAt: Date.now()
    };
  }

  /* ── Network ──────────────────────────────────────────────────────── */
  function fetchForecast(place) {
    var url = FORECAST + '?' + qs({
      latitude: place.latitude, longitude: place.longitude,
      current: CURRENT_FIELDS, hourly: HOURLY_FIELDS, daily: DAILY_FIELDS,
      timezone: 'auto', forecast_days: 7, past_hours: 1
    });
    var airUrl = AIR + '?' + qs({
      latitude: place.latitude, longitude: place.longitude,
      current: 'us_aqi,pm2_5,pm10,ozone', timezone: 'auto'
    });
    return Promise.all([
      getJSON(url),
      getJSON(airUrl).catch(function () { return null; })
    ]).then(function (res) {
      var f = res[0], a = res[1];
      return {
        source: 'live',
        place: place,
        timezone: f.timezone,
        utcOffsetSeconds: f.utc_offset_seconds,
        elevation: f.elevation,
        current: f.current,
        currentUnits: f.current_units,
        hourly: f.hourly,
        hourlyUnits: f.hourly_units,
        daily: f.daily,
        dailyUnits: f.daily_units,
        air: a && a.current ? a.current : null,
        fetchedAt: Date.now()
      };
    });
  }

  /* ── Cache ────────────────────────────────────────────────────────── */
  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        at: Date.now(),
        place: data.place,
        payload: {
          source: 'cache', place: data.place, timezone: data.timezone,
          utcOffsetSeconds: data.utcOffsetSeconds, current: data.current,
          hourly: data.hourly, daily: data.daily, air: data.air,
          fetchedAt: data.fetchedAt
        }
      }));
    } catch (e) { /* quota or private mode */ }
  }
  function readCache(maxAge) {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.payload) return null;
      if (maxAge && Date.now() - o.at > maxAge) return null;
      return o.payload;
    } catch (e) { return null; }
  }
  function savePlace(place) {
    try { localStorage.setItem(PLACE_KEY, JSON.stringify(place)); } catch (e) {}
  }
  function readPlace() {
    try {
      var raw = localStorage.getItem(PLACE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  /* ── Public API ───────────────────────────────────────────────────── */
  /**
   * load(place) -> Promise<dataset>
   * Never rejects: falls back to cache, then to the local model.
   */
  function load(place) {
    return fetchForecast(place).then(function (data) {
      saveCache(data);
      savePlace(place);
      return data;
    }).catch(function (err) {
      var cached = readCache(TTL);
      if (cached) {
        cached.stale = true;
        cached.error = err && err.message;
        return cached;
      }
      var sim = simulate(place, Date.now());
      sim.error = err && err.message;
      return sim;
    });
  }

  function search(query, signal) {
    var url = GEO + '?' + qs({ name: query, count: 8, language: 'en', format: 'json' });
    return fetch(url, { signal: signal, mode: 'cors' }).then(function (r) { return r.json(); })
      .then(function (d) {
        return (d.results || []).map(function (r) {
          return {
            id: r.id, name: r.name, country: r.country, countryCode: r.country_code,
            admin1: r.admin1, latitude: r.latitude, longitude: r.longitude,
            timezone: r.timezone, population: r.population
          };
        });
      });
  }

  function reverse(lat, lon) {
    var url = GEO + '?' + qs({ name: '', latitude: lat, longitude: lon, count: 1, language: 'en', format: 'json' });
    /* Open-Meteo geocoding needs a name; fall back to a generic label. */
    return fetch(url).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  /** "My location" via the browser geolocation API. */
  function locate() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) return reject(new Error('Geolocation is not supported by this browser.'));
      navigator.geolocation.getCurrentPosition(function (pos) {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      }, function (err) {
        var msg = err.code === 1 ? 'Location permission was denied.' :
                  err.code === 2 ? 'Your location is unavailable.' : 'Locating you timed out.';
        reject(new Error(msg));
      }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    });
  }

  global.WXApi = {
    load: load, search: search, locate: locate,
    simulate: simulate, readCache: readCache, readPlace: readPlace, savePlace: savePlace,
    sunTimes: sunTimes, solar: solar,
    CACHE_TTL: TTL
  };
})(typeof window !== 'undefined' ? window : globalThis);
