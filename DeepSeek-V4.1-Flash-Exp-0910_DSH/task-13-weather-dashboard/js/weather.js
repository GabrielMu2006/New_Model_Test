/* ==========================================================================
   weather.js — WMO code mapping, unit conversion and formatting helpers.
   Pure functions, no DOM. Exposed as window.WX.
   ========================================================================== */
(function (global) {
  'use strict';

  /* ── WMO weather interpretation codes ─────────────────────────────── */
  var WMO = {
    0:  { label: 'Clear sky',            kind: 'clear',  group: 'clear' },
    1:  { label: 'Mainly clear',         kind: 'mostly', group: 'clear' },
    2:  { label: 'Partly cloudy',        kind: 'partly', group: 'cloud' },
    3:  { label: 'Overcast',             kind: 'cloudy', group: 'cloud' },
    45: { label: 'Fog',                  kind: 'fog',    group: 'fog'   },
    48: { label: 'Freezing fog',         kind: 'fog',    group: 'fog'   },
    51: { label: 'Light drizzle',        kind: 'drizzle',group: 'rain'  },
    53: { label: 'Drizzle',              kind: 'drizzle',group: 'rain'  },
    55: { label: 'Heavy drizzle',        kind: 'drizzle',group: 'rain'  },
    56: { label: 'Freezing drizzle',     kind: 'sleet',  group: 'rain'  },
    57: { label: 'Freezing drizzle',     kind: 'sleet',  group: 'rain'  },
    61: { label: 'Light rain',           kind: 'rain',   group: 'rain'  },
    63: { label: 'Rain',                 kind: 'rain',   group: 'rain'  },
    65: { label: 'Heavy rain',           kind: 'rain',   group: 'rain'  },
    66: { label: 'Freezing rain',        kind: 'sleet',  group: 'rain'  },
    67: { label: 'Freezing rain',        kind: 'sleet',  group: 'rain'  },
    71: { label: 'Light snow',           kind: 'snow',   group: 'snow'  },
    73: { label: 'Snow',                 kind: 'snow',   group: 'snow'  },
    75: { label: 'Heavy snow',           kind: 'snow',   group: 'snow'  },
    77: { label: 'Snow grains',          kind: 'snow',   group: 'snow'  },
    80: { label: 'Light showers',        kind: 'showers',group: 'rain'  },
    81: { label: 'Showers',              kind: 'showers',group: 'rain'  },
    82: { label: 'Violent showers',      kind: 'showers',group: 'rain'  },
    85: { label: 'Snow showers',         kind: 'snow',   group: 'snow'  },
    86: { label: 'Heavy snow showers',   kind: 'snow',   group: 'snow'  },
    95: { label: 'Thunderstorm',         kind: 'storm',  group: 'storm' },
    96: { label: 'Thunderstorm, hail',   kind: 'storm',  group: 'storm' },
    99: { label: 'Severe thunderstorm',  kind: 'storm',  group: 'storm' }
  };

  function describe(code) {
    return WMO[code] || { label: 'Unknown', kind: 'partly', group: 'cloud' };
  }

  /* Sky palette key used by the CSS theming layer. */
  function skyState(code, isDay) {
    var d = describe(code);
    var night = !isDay;
    switch (d.group) {
      case 'clear':  return d.kind === 'mostly' ? (night ? 'partly-night' : 'partly-day')
                                                : (night ? 'clear-night' : 'clear-day');
      case 'cloud':  return code === 2 ? (night ? 'partly-night' : 'partly-day')
                              : (night ? 'cloudy-night' : 'cloudy-day');
      case 'fog':    return 'fog';
      case 'rain':   return 'rain';
      case 'snow':   return 'snow';
      case 'storm':  return 'storm';
      default:       return night ? 'cloudy-night' : 'cloudy-day';
    }
  }

  /* ── Units ────────────────────────────────────────────────────────── */
  function c2f(c) { return c * 9 / 5 + 32; }
  function f2c(f) { return (f - 32) * 5 / 9; }

  /** Convert a Celsius value to the active unit. */
  function temp(celsius, unit) {
    if (celsius == null || isNaN(celsius)) return null;
    return unit === 'F' ? c2f(celsius) : celsius;
  }
  /** Convert km/h to the active unit (mph for imperial). */
  function speed(kmh, unit) {
    if (kmh == null || isNaN(kmh)) return null;
    return unit === 'F' ? kmh * 0.621371 : kmh;
  }
  function speedUnit(unit) { return unit === 'F' ? 'mph' : 'km/h'; }
  /** Convert millimetres to the active unit (inches for imperial). */
  function precip(mm, unit) {
    if (mm == null || isNaN(mm)) return null;
    return unit === 'F' ? mm / 25.4 : mm;
  }
  function precipUnit(unit) { return unit === 'F' ? 'in' : 'mm'; }
  /** Convert metres to the active unit (miles for imperial). */
  function distance(metres, unit) {
    if (metres == null || isNaN(metres)) return null;
    return unit === 'F' ? metres / 1609.344 : metres / 1000;
  }
  function distanceUnit(unit) { return unit === 'F' ? 'mi' : 'km'; }

  function round(v, dp) {
    if (v == null || isNaN(v)) return null;
    var p = Math.pow(10, dp == null ? 0 : dp);
    return Math.round(v * p) / p;
  }

  /** Display string for a temperature, rounded, no unit suffix. */
  function tempText(celsius, unit) {
    var v = temp(celsius, unit);
    return v == null ? '—' : String(Math.round(v));
  }
  function tempText1(celsius, unit) {
    var v = temp(celsius, unit);
    return v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1);
  }

  /* ── Wind ─────────────────────────────────────────────────────────── */
  var COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  function windDir(deg) {
    if (deg == null || isNaN(deg)) return '—';
    return COMPASS[Math.round(((deg % 360) + 360) % 360 / 22.5) % 16];
  }
  /** Beaufort force from km/h. */
  function beaufort(kmh) {
    if (kmh == null) return null;
    var bounds = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];
    for (var i = 0; i < bounds.length; i++) if (kmh < bounds[i]) return i;
    return 12;
  }
  var BEAUFORT_LABEL = ['Calm','Light air','Light breeze','Gentle breeze','Moderate breeze',
    'Fresh breeze','Strong breeze','Near gale','Gale','Strong gale','Storm','Violent storm','Hurricane'];
  function windLabel(kmh) {
    var b = beaufort(kmh);
    return b == null ? '—' : BEAUFORT_LABEL[b];
  }

  /* ── Air quality (US AQI) ─────────────────────────────────────────── */
  var AQI_BANDS = [
    { max: 50,  label: 'Good',                  color: '#4ade80', note: 'Air quality is satisfactory.' },
    { max: 100, label: 'Moderate',              color: '#facc15', note: 'Acceptable; unusually sensitive people may be affected.' },
    { max: 150, label: 'Unhealthy for some',    color: '#fb923c', note: 'Sensitive groups may feel effects.' },
    { max: 200, label: 'Unhealthy',             color: '#f87171', note: 'Everyone may begin to feel effects.' },
    { max: 300, label: 'Very unhealthy',        color: '#c084fc', note: 'Health alert: risk for everyone.' },
    { max: Infinity, label: 'Hazardous',        color: '#f472b6', note: 'Emergency conditions.' }
  ];
  function aqi(a) {
    if (a == null || isNaN(a)) return null;
    for (var i = 0; i < AQI_BANDS.length; i++) if (a <= AQI_BANDS[i].max) return AQI_BANDS[i];
    return AQI_BANDS[AQI_BANDS.length - 1];
  }

  /* ── UV index ─────────────────────────────────────────────────────── */
  var UV_BANDS = [
    { max: 2,        label: 'Low',       note: 'No protection needed.' },
    { max: 5,        label: 'Moderate',  note: 'Seek shade near midday.' },
    { max: 7,        label: 'High',      note: 'Sunscreen and a hat advised.' },
    { max: 10,       label: 'Very high', note: 'Minimise sun exposure midday.' },
    { max: Infinity, label: 'Extreme',   note: 'Avoid the sun at midday.' }
  ];
  function uv(v) {
    if (v == null || isNaN(v)) return null;
    for (var i = 0; i < UV_BANDS.length; i++) if (v < UV_BANDS[i].max) return UV_BANDS[i];
    return UV_BANDS[UV_BANDS.length - 1];
  }

  /* ── Humidity / dew point ─────────────────────────────────────────── */
  function humidityNote(h) {
    if (h == null) return '—';
    if (h < 30) return 'Very dry air';
    if (h < 45) return 'Dry air';
    if (h < 60) return 'Comfortable';
    if (h < 75) return 'Slightly humid';
    if (h < 90) return 'Humid';
    return 'Very humid';
  }
  /** Magnus formula; used when the API has no dew point for a given hour. */
  function dewPoint(celsius, rh) {
    if (celsius == null || rh == null) return null;
    var a = 17.62, b = 243.12;
    var g = (a * celsius) / (b + celsius) + Math.log(Math.max(rh, 1) / 100);
    return (b * g) / (a - g);
  }
  function dewNote(celsius) {
    if (celsius == null) return '—';
    if (celsius < 5) return 'Dry and crisp';
    if (celsius < 13) return 'Pleasantly dry';
    if (celsius < 18) return 'Comfortable';
    if (celsius < 21) return 'Slightly muggy';
    if (celsius < 24) return 'Muggy';
    return 'Oppressive';
  }

  /* ── Pressure ─────────────────────────────────────────────────────── */
  function pressureNote(hPa, trend) {
    if (hPa == null) return '—';
    var level = hPa < 1000 ? 'Low' : hPa < 1009 ? 'Below normal'
      : hPa < 1021 ? 'Normal' : hPa < 1030 ? 'High' : 'Very high';
    if (trend == null) return level;
    if (trend > 1) return level + ' · rising';
    if (trend < -1) return level + ' · falling';
    return level + ' · steady';
  }

  /* ── Visibility ───────────────────────────────────────────────────── */
  function visibilityNote(metres) {
    if (metres == null) return '—';
    if (metres < 200)  return 'Dense fog';
    if (metres < 1000) return 'Fog';
    if (metres < 4000) return 'Poor';
    if (metres < 10000) return 'Moderate';
    if (metres < 20000) return 'Good';
    return 'Excellent';
  }

  /* ── Precipitation ────────────────────────────────────────────────── */
  function precipNote(mm) {
    if (mm == null) return 'No precipitation';
    if (mm === 0) return 'No precipitation';
    if (mm < 0.5) return 'A trace of precipitation';
    if (mm < 2.5) return 'Light precipitation';
    if (mm < 7.5) return 'Moderate precipitation';
    return 'Heavy precipitation';
  }

  /* ── Time helpers ─────────────────────────────────────────────────── */
  /**
   * Parse an ISO local string from the API ("2026-09-08T14:00") into an
   * absolute epoch, given the location's UTC offset in seconds.
   *
   * The API returns wall-clock strings with no zone designator, so they must be
   * read as UTC first (hence the appended "Z") before the offset is removed.
   * Letting Date.parse localise them instead would apply the *browser's* offset
   * and then subtract the location's offset a second time.
   */
  function parseLocal(iso, offsetSeconds) {
    var s = String(iso).trim();
    if (s.length === 10) s += 'T12:00';
    if (s.length === 16) s += ':00';
    if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(s)) s += 'Z';
    var t = Date.parse(s);
    if (isNaN(t)) t = Date.parse(s.replace(' ', 'T'));
    return t - (offsetSeconds || 0) * 1000;
  }
  /** A Date whose UTC fields show the location's wall-clock time. */
  function wall(epoch, offsetSeconds) {
    return new Date(epoch + (offsetSeconds || 0) * 1000);
  }
  function hhmm(epoch, offsetSeconds) {
    var d = wall(epoch, offsetSeconds);
    var h = d.getUTCHours(), m = d.getUTCMinutes();
    var ampm = h < 12 ? 'AM' : 'PM';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ':' + (m < 10 ? '0' : '') + m + ' ' + ampm;
  }
  function hourLabel(epoch, offsetSeconds) {
    var h = wall(epoch, offsetSeconds).getUTCHours();
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return (h % 12) + (h < 12 ? ' AM' : ' PM');
  }
  function weekdayShort(epoch, offsetSeconds) {
    return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][wall(epoch, offsetSeconds).getUTCDay()];
  }
  function monthDay(epoch, offsetSeconds) {
    var d = wall(epoch, offsetSeconds);
    return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()] +
      ' ' + d.getUTCDate();
  }
  function dayKey(epoch, offsetSeconds) {
    var d = wall(epoch, offsetSeconds);
    return d.getUTCFullYear() + '-' + (d.getUTCMonth() + 1) + '-' + d.getUTCDate();
  }
  function relative(fromMs, nowMs) {
    var s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
    if (s < 45) return 'just now';
    var m = Math.round(s / 60);
    if (m < 60) return m + ' min ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + (h === 1 ? ' hour ago' : ' hours ago');
    var d = Math.round(h / 24);
    return d + (d === 1 ? ' day ago' : ' days ago');
  }

  /* ── Sun ──────────────────────────────────────────────────────────── */
  /** 0 before sunrise, 1 after sunset, else the fraction of daylight elapsed. */
  function daylightProgress(sunrise, sunset, now) {
    if (!sunrise || !sunset) return 0;
    if (now <= sunrise) return 0;
    if (now >= sunset) return 1;
    return (now - sunrise) / (sunset - sunrise);
  }
  function daylightLength(sunrise, sunset) {
    if (!sunrise || !sunset) return 0;
    return sunset - sunrise;
  }
  function durationText(ms) {
    if (!ms) return '—';
    var totalMin = Math.round(ms / 60000);
    return Math.floor(totalMin / 60) + 'h ' + (totalMin % 60 < 10 ? '0' : '') + (totalMin % 60) + 'm';
  }

  /** Comfort-oriented one-line summary used in the hero. */
  function summary(cur, daily, unit) {
    var parts = [];
    var d = describe(cur.weather_code);
    parts.push(d.label + ' right now');
    if (daily && daily.temperature_2m_max && daily.temperature_2m_max.length) {
      parts.push('topping out near ' + tempText(daily.temperature_2m_max[0], unit) + '°');
    }
    return parts.join(', ');
  }

  global.WX = {
    WMO: WMO,
    describe: describe,
    skyState: skyState,
    c2f: c2f, f2c: f2c,
    temp: temp, speed: speed, precip: precip, distance: distance,
    speedUnit: speedUnit, precipUnit: precipUnit, distanceUnit: distanceUnit,
    round: round, tempText: tempText, tempText1: tempText1,
    windDir: windDir, windLabel: windLabel, beaufort: beaufort,
    aqi: aqi, uv: uv,
    humidityNote: humidityNote, dewPoint: dewPoint, dewNote: dewNote,
    pressureNote: pressureNote, visibilityNote: visibilityNote, precipNote: precipNote,
    parseLocal: parseLocal, wall: wall, hhmm: hhmm, hourLabel: hourLabel,
    weekdayShort: weekdayShort, monthDay: monthDay, dayKey: dayKey, relative: relative,
    daylightProgress: daylightProgress, daylightLength: daylightLength, durationText: durationText,
    summary: summary
  };
})(typeof window !== 'undefined' ? window : globalThis);
