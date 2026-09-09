/* ==========================================================================
   app.js — state, rendering and interaction for the Skylight dashboard.
   ========================================================================== */
(function (global) {
  'use strict';

  var WX = global.WX, Icon = global.WXIcon, Chart = global.WXChart, Api = global.WXApi;

  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;

  /* ── State ────────────────────────────────────────────────────────── */
  var state = {
    place: null,
    data: null,
    unit: 'C',
    theme: 'dark',
    hourlyDetailed: false,
    loading: false,
    lastGoodAt: 0
  };

  var DEFAULTS = [
    { name: 'San Francisco', admin1: 'California', country: 'United States', countryCode: 'US',
      latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles' }
  ];

  var ZONE_CITY = {
    'Asia/Shanghai': { name: 'Shanghai', country: 'China', countryCode: 'CN', admin1: '', latitude: 31.2304, longitude: 121.4737, timezone: 'Asia/Shanghai' },
    'Asia/Tokyo': { name: 'Tokyo', country: 'Japan', countryCode: 'JP', admin1: '', latitude: 35.6895, longitude: 139.6917, timezone: 'Asia/Tokyo' },
    'Asia/Singapore': { name: 'Singapore', country: 'Singapore', countryCode: 'SG', admin1: '', latitude: 1.3521, longitude: 103.8198, timezone: 'Asia/Singapore' },
    'Asia/Hong_Kong': { name: 'Hong Kong', country: 'Hong Kong', countryCode: 'HK', admin1: '', latitude: 22.3193, longitude: 114.1694, timezone: 'Asia/Hong_Kong' },
    'Asia/Seoul': { name: 'Seoul', country: 'South Korea', countryCode: 'KR', admin1: '', latitude: 37.5665, longitude: 126.9780, timezone: 'Asia/Seoul' },
    'Asia/Kolkata': { name: 'Mumbai', country: 'India', countryCode: 'IN', admin1: '', latitude: 19.0760, longitude: 72.8777, timezone: 'Asia/Kolkata' },
    'Europe/London': { name: 'London', country: 'United Kingdom', countryCode: 'GB', admin1: '', latitude: 51.5072, longitude: -0.1276, timezone: 'Europe/London' },
    'Europe/Paris': { name: 'Paris', country: 'France', countryCode: 'FR', admin1: '', latitude: 48.8566, longitude: 2.3522, timezone: 'Europe/Paris' },
    'Europe/Berlin': { name: 'Berlin', country: 'Germany', countryCode: 'DE', admin1: '', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin' },
    'Europe/Moscow': { name: 'Moscow', country: 'Russia', countryCode: 'RU', admin1: '', latitude: 55.7558, longitude: 37.6173, timezone: 'Europe/Moscow' },
    'America/New_York': { name: 'New York', country: 'United States', countryCode: 'US', admin1: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York' },
    'America/Chicago': { name: 'Chicago', country: 'United States', countryCode: 'US', admin1: 'Illinois', latitude: 41.8781, longitude: -87.6298, timezone: 'America/Chicago' },
    'America/Denver': { name: 'Denver', country: 'United States', countryCode: 'US', admin1: 'Colorado', latitude: 39.7392, longitude: -104.9903, timezone: 'America/Denver' },
    'America/Los_Angeles': { name: 'San Francisco', country: 'United States', countryCode: 'US', admin1: 'California', latitude: 37.7749, longitude: -122.4194, timezone: 'America/Los_Angeles' },
    'America/Sao_Paulo': { name: 'São Paulo', country: 'Brazil', countryCode: 'BR', admin1: '', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo' },
    'Australia/Sydney': { name: 'Sydney', country: 'Australia', countryCode: 'AU', admin1: 'New South Wales', latitude: -33.8688, longitude: 151.2093, timezone: 'Australia/Sydney' },
    'Africa/Cairo': { name: 'Cairo', country: 'Egypt', countryCode: 'EG', admin1: '', latitude: 30.0444, longitude: 31.2357, timezone: 'Africa/Cairo' },
    'Africa/Lagos': { name: 'Lagos', country: 'Nigeria', countryCode: 'NG', admin1: '', latitude: 6.5244, longitude: 3.3792, timezone: 'Africa/Lagos' }
  };

  function flag(code) {
    if (!code || code.length !== 2) return '📍';
    return String.fromCodePoint.apply(String, code.toUpperCase().split('').map(function (c) {
      return 0x1F1E6 + c.charCodeAt(0) - 65;
    }));
  }
  function placeLabel(p) {
    return p.name + (p.admin1 && p.admin1 !== p.name ? ', ' + p.admin1 : '');
  }

  /* ── Small DOM helpers ────────────────────────────────────────────── */
  function setText(id, value) {
    var n = $(id);
    if (n && n.textContent !== String(value)) n.textContent = value;
  }
  function h(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt != null) n.textContent = txt;
    return n;
  }
  function svgIcon(paths, extra) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.9');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    if (extra) for (var k in extra) s.setAttribute(k, extra[k]);
    (paths || []).forEach(function (d) {
      var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      s.appendChild(p);
    });
    return s;
  }
  var ICONS = {
    wind: ['M3 8h10.5a2.75 2.75 0 1 0-2.6-3.6', 'M3 12h13.5a2.75 2.75 0 1 1-2.6 3.6', 'M3 16h6.5a2.4 2.4 0 1 1-2.3 3.2'],
    drop: ['M12 3.2s5.6 6.2 5.6 9.6a5.6 5.6 0 1 1-11.2 0C6.4 9.4 12 3.2 12 3.2Z'],
    sun: ['M12 7.4a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z', 'M12 2.6v2.1M12 19.3v2.1M2.6 12h2.1M19.3 12h2.1M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5'],
    air: ['M4 9h9.5a2.6 2.6 0 1 0-2.5-3.4', 'M4 14h13a2.6 2.6 0 1 1-2.5 3.4', 'M4 19h5'],
    gauge: ['M12 20a8 8 0 1 1 8-8', 'M12 12l4.2-3.4', 'M12 12h.01'],
    eye: ['M2.5 12S6.4 5.8 12 5.8 21.5 12 21.5 12 17.6 18.2 12 18.2 2.5 12 2.5 12Z', 'M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z'],
    sunpath: ['M3 19h18', 'M6.5 15.5a7.5 7.5 0 0 1 11 0', 'M12 4.2v2.4'],
    rain: ['M7 15.4a4.2 4.2 0 0 1-.4-8.4A5.6 5.6 0 0 1 17.4 8a3.7 3.7 0 0 1 .2 7.4', 'M8.6 18.2 7.8 21M12.4 18.2l-.8 2.8M16.2 18.2l-.8 2.8']
  };

  /* ── Toast ────────────────────────────────────────────────────────── */
  var toastTimer = 0;
  function toast(message, kind) {
    var t = $('toast');
    t.innerHTML = '';
    t.appendChild(svgIcon(kind === 'error'
      ? ['M12 3.2 2.6 20h18.8L12 3.2Z', 'M12 9.6v4.6', 'M12 17.2h.01']
      : ['M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2Z', 'm8.4 12.2 2.6 2.6 4.6-5.2']));
    t.appendChild(document.createTextNode(message));
    t.hidden = false;
    requestAnimationFrame(function () { t.classList.add('is-on'); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      t.classList.remove('is-on');
      setTimeout(function () { t.hidden = true; }, 320);
    }, 4200);
  }

  /* ── Derived model ────────────────────────────────────────────────── */
  function buildModel(d) {
    var off = d.utcOffsetSeconds || 0;
    var now = Date.now();
    var cur = d.current || {};
    var hourly = d.hourly || { time: [] };
    var daily = d.daily || { time: [] };

    /* Absolute epoch for every hourly sample. */
    var times = (hourly.time || []).map(function (iso) { return WX.parseLocal(iso, off); });

    /* Index of the sample closest to now, never in the past by more than 1h. */
    var nowIdx = 0, best = Infinity;
    for (var i = 0; i < times.length; i++) {
      var diff = Math.abs(times[i] - now);
      if (diff < best) { best = diff; nowIdx = i; }
    }
    /* Prefer the first sample at or after the current hour. */
    for (var j = 0; j < times.length; j++) {
      if (times[j] >= now - 30 * 60000) { nowIdx = j; break; }
    }

    var hours = [];
    for (var k = nowIdx; k < Math.min(times.length, nowIdx + 24); k++) {
      hours.push({
        epoch: times[k],
        label: WX.hourLabel(times[k], off),
        fullLabel: WX.hhmm(times[k], off),
        temp: hourly.temperature_2m[k],
        feels: hourly.apparent_temperature[k],
        pop: hourly.precipitation_probability[k],
        code: hourly.weather_code[k],
        isDay: hourly.is_day[k] === 1,
        wind: hourly.wind_speed_10m[k],
        windDir: hourly.wind_direction_10m[k],
        humidity: hourly.relative_humidity_2m[k],
        uv: hourly.uv_index[k],
        precip: hourly.precipitation[k],
        isNow: k === nowIdx
      });
    }

    var days = [];
    for (var m = 0; m < (daily.time || []).length; m++) {
      var dayEpoch = WX.parseLocal(daily.time[m] + 'T12:00', off);
      var sunrise = daily.sunrise && daily.sunrise[m] ? WX.parseLocal(daily.sunrise[m], off) : null;
      var sunset = daily.sunset && daily.sunset[m] ? WX.parseLocal(daily.sunset[m], off) : null;
      days.push({
        epoch: dayEpoch,
        key: WX.dayKey(dayEpoch, off),
        name: WX.weekdayShort(dayEpoch, off),
        date: WX.monthDay(dayEpoch, off),
        code: daily.weather_code[m],
        hi: daily.temperature_2m_max[m],
        lo: daily.temperature_2m_min[m],
        sunrise: sunrise, sunset: sunset,
        uvMax: daily.uv_index_max ? daily.uv_index_max[m] : null,
        precipSum: daily.precipitation_sum ? daily.precipitation_sum[m] : null,
        pop: daily.precipitation_probability_max ? daily.precipitation_probability_max[m] : null,
        windMax: daily.wind_speed_10m_max ? daily.wind_speed_10m_max[m] : null,
        windDir: daily.wind_direction_10m_dominant ? daily.wind_direction_10m_dominant[m] : null
      });
    }

    /* Sunrise/sunset for right now. */
    var todayIdx = 0;
    var todayKey = WX.dayKey(now, off);
    for (var n = 0; n < days.length; n++) if (days[n].key === todayKey) todayIdx = n;
    var today = days[todayIdx] || days[0] || {};
    var sunrise = today.sunrise || null, sunset = today.sunset || null;
    var progress = WX.daylightProgress(sunrise, sunset, now);

    /* Pressure trend from the real hourly series when available. */
    var pressSeries = [];
    if (hourly.pressure_msl && hourly.pressure_msl.length) {
      for (var q = Math.max(0, nowIdx - 6); q < Math.min(times.length, nowIdx + 12); q++) {
        pressSeries.push(hourly.pressure_msl[q]);
      }
    }
    var pressNow = cur.pressure_msl != null ? cur.pressure_msl
      : (pressSeries.length ? pressSeries[Math.min(6, pressSeries.length - 1)] : null);
    var pressTrend = null;
    if (pressSeries.length > 3) {
      pressTrend = pressSeries[Math.min(6, pressSeries.length - 1)] - pressSeries[0];
    }

    return {
      off: off, now: now, nowIdx: nowIdx, cur: cur,
      hours: hours, days: days, today: today,
      sunrise: sunrise, sunset: sunset, progress: progress,
      todayIdx: todayIdx, pressTrend: pressTrend, pressSeries: pressSeries, pressNow: pressNow,
      isDay: cur.is_day === 1,
      sky: WX.skyState(cur.weather_code, cur.is_day === 1)
    };
  }

  /* ── Renderers ────────────────────────────────────────────────────── */
  function renderAll() {
    if (!state.data) return;
    var model = buildModel(state.data);
    state.model = model;

    root.setAttribute('data-sky', model.sky);
    if (state.effects) state.effects.set(model.sky);

    renderHero(model);
    renderHourly(model);
    renderDaily(model);
    renderDetails(model);
    renderFooter(model);

    var d = WX.describe(model.cur.weather_code);
    document.title = WX.tempText(model.cur.temperature_2m, state.unit) + '° ' + d.label +
      ' · ' + state.data.place.name + ' — Skylight';
  }

  function renderHero(m) {
    var d = state.data, place = d.place, cur = m.cur;
    setText('placeName', place.name);
    setText('placeRegion', place.admin1 && place.admin1 !== place.name
      ? place.admin1 + (place.country ? ', ' + place.country : '')
      : (place.country || ''));

    setText('localTime', WX.hhmm(m.now, m.off));
    setText('tempNow', WX.tempText(cur.temperature_2m, state.unit));
    setText('tempUnit', '°' + state.unit);
    setText('condText', WX.describe(cur.weather_code).label);
    setText('feelsLike', WX.tempText(cur.apparent_temperature, state.unit) + '°');
    setText('hiLo', 'H ' + WX.tempText(m.today.hi, state.unit) + '°  L ' + WX.tempText(m.today.lo, state.unit) + '°');

    var iconWrap = $('heroIcon');
    iconWrap.innerHTML = '';
    iconWrap.appendChild(Icon.make(WX.describe(cur.weather_code).kind, m.isDay, { size: 104 }));

    /* Chips */
    var chips = $('heroChips');
    chips.innerHTML = '';
    function chip(iconPaths, label, value) {
      var li = h('li');
      li.appendChild(svgIcon(iconPaths));
      li.appendChild(document.createTextNode(label + ' '));
      var b = h('b', null, value);
      li.appendChild(b);
      chips.appendChild(li);
    }
    chip(ICONS.wind, 'Wind', Math.round(WX.speed(cur.wind_speed_10m, state.unit)) + ' ' + WX.speedUnit(state.unit) + ' ' + WX.windDir(cur.wind_direction_10m));
    chip(ICONS.drop, 'Humidity', Math.round(cur.relative_humidity_2m) + '%');
    var uvNow = m.hours[0] ? m.hours[0].uv : null;
    if (uvNow != null) chip(ICONS.sun, 'UV', String(Math.round(uvNow)));
    var aqiBand = d.air && d.air.us_aqi != null ? WX.aqi(d.air.us_aqi) : null;
    if (aqiBand) chip(ICONS.air, 'Air', aqiBand.label);

    /* Chart */
    var chartData = m.hours.slice(0, 12).map(function (h2) {
      return { x: h2.label.replace(':00', ''), temp: WX.temp(h2.temp, state.unit), pop: h2.pop, isDay: h2.isDay, now: h2.isNow };
    });
    Chart.spark($('heroSpark'), chartData, {
      tempFormat: function (t) { return t == null ? '—' : Math.round(t) + '°'; }
    });
  }

  function renderHourly(m) {
    var wrap = $('hourly');
    wrap.classList.toggle('is-detailed', state.hourlyDetailed);
    wrap.innerHTML = '';
    setText('hourlySub', 'Next ' + m.hours.length + ' hours · local time');

    m.hours.forEach(function (hour) {
      var cell = h('div', 'hour' + (hour.isNow ? ' is-now' : ''));
      cell.setAttribute('role', 'listitem');
      cell.appendChild(h('span', 'hour__t', hour.isNow ? 'Now' : hour.label));

      var iw = h('div', 'hour__icon');
      iw.appendChild(Icon.make(WX.describe(hour.code).kind, hour.isDay, { size: 34 }));
      cell.appendChild(iw);

      cell.appendChild(h('span', 'hour__temp', WX.tempText(hour.temp, state.unit) + '°'));

      var pop = h('span', 'hour__pop');
      pop.setAttribute('data-zero', hour.pop ? '0' : '1');
      pop.appendChild(svgIcon(ICONS.drop, { 'stroke-width': '2.2' }));
      pop.appendChild(document.createTextNode(Math.round(hour.pop || 0) + '%'));
      cell.appendChild(pop);

      if (state.hourlyDetailed) {
        var ex = h('div', 'hour__extra');
        [['Feels', WX.tempText(hour.feels, state.unit) + '°'],
         [WX.speedUnit(state.unit), Math.round(WX.speed(hour.wind, state.unit)) + ''],
         ['Hum', Math.round(hour.humidity) + '%']].forEach(function (row) {
          var s = h('span');
          s.appendChild(document.createTextNode(row[0]));
          s.appendChild(h('b', null, row[1]));
          ex.appendChild(s);
        });
        cell.appendChild(ex);
      }
      cell.title = hour.fullLabel + ' · ' + WX.describe(hour.code).label;
      wrap.appendChild(cell);
    });
  }

  function renderDaily(m) {
    var wrap = $('daily');
    wrap.innerHTML = '';

    var lo = Infinity, hi = -Infinity;
    m.days.forEach(function (d) {
      if (d.lo != null) lo = Math.min(lo, d.lo);
      if (d.hi != null) hi = Math.max(hi, d.hi);
    });
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (hi - lo < 1) hi = lo + 1;
    var pad = (hi - lo) * 0.06;
    lo -= pad; hi += pad;
    var span = hi - lo;

    var todayKey = WX.dayKey(m.now, m.off);
    var tomorrowKey = WX.dayKey(m.now + 86400000, m.off);

    m.days.forEach(function (d) {
      var row = h('div', 'day' + (d.key === todayKey ? ' is-today' : ''));
      row.setAttribute('role', 'listitem');

      var name = h('div', 'day__name');
      name.appendChild(document.createTextNode(
        d.key === todayKey ? 'Today' : d.key === tomorrowKey ? 'Tomorrow' : d.name));
      var small = h('small', null, d.date);
      name.appendChild(small);
      row.appendChild(name);

      var iw = h('div', 'day__icon');
      iw.appendChild(Icon.make(WX.describe(d.code).kind, true, { size: 34 }));
      iw.title = WX.describe(d.code).label;
      row.appendChild(iw);

      var bar = h('div', 'day__bar');
      var left = ((d.lo - lo) / span) * 100;
      var width = ((d.hi - d.lo) / span) * 100;
      var range = h('div', 'day__range');
      range.style.left = Math.max(0, Math.min(100, left)).toFixed(2) + '%';
      range.style.width = Math.max(2, Math.min(100 - left, width)).toFixed(2) + '%';
      bar.appendChild(range);

      if (d.key === todayKey && m.cur.temperature_2m != null) {
        var t = Math.max(d.lo, Math.min(d.hi, m.cur.temperature_2m));
        var pos = ((t - lo) / span) * 100;
        var marker = h('div', 'day__marker');
        marker.style.left = Math.max(0, Math.min(100, pos)).toFixed(2) + '%';
        marker.title = 'Now ' + WX.tempText(m.cur.temperature_2m, state.unit) + '°';
        bar.appendChild(marker);
      }
      row.appendChild(bar);

      var temps = h('div', 'day__temps');
      var hiEl = h('span', 'day__hi', WX.tempText(d.hi, state.unit) + '°');
      var loEl = h('span', 'day__lo', WX.tempText(d.lo, state.unit) + '°');
      temps.appendChild(hiEl);
      temps.appendChild(loEl);
      if (d.pop != null) {
        var popEl = h('span', 'day__pop', Math.round(d.pop) + '% rain');
        var box = h('div');
        box.appendChild(temps);
        box.appendChild(popEl);
        row.appendChild(box);
      } else {
        row.appendChild(temps);
      }
      row.title = WX.describe(d.code).label + ' · ' + WX.tempText(d.hi, state.unit) + '° / ' + WX.tempText(d.lo, state.unit) + '°';
      wrap.appendChild(row);
    });
  }

  function tile(label, iconPaths, build) {
    var t = h('article', 'tile');
    var head = h('div', 'tile__head');
    var lab = h('div', 'tile__label');
    lab.appendChild(svgIcon(iconPaths));
    lab.appendChild(document.createTextNode(label));
    head.appendChild(lab);
    t.appendChild(head);
    build(t);
    return t;
  }

  function renderDetails(m) {
    var grid = $('details');
    grid.innerHTML = '';
    var d = state.data, cur = m.cur, unit = state.unit;
    var frag = document.createDocumentFragment();

    /* 1 — Wind */
    frag.appendChild(tile('Wind', ICONS.wind, function (t) {
      var body = h('div', 'tile__body');
      var left = h('div');
      var v = h('div', 'tile__value', String(Math.round(WX.speed(cur.wind_speed_10m, unit))));
      v.appendChild(h('sup', null, WX.speedUnit(unit)));
      left.appendChild(v);
      left.appendChild(h('div', 'tile__note', 'From ' + WX.windDir(cur.wind_direction_10m) + ' · ' + WX.windLabel(cur.wind_speed_10m)));
      var gust = h('div', 'tile__note', 'Gusts ' + Math.round(WX.speed(cur.wind_gusts_10m, unit)) + ' ' + WX.speedUnit(unit));
      gust.style.marginTop = '3px';
      gust.style.opacity = '.75';
      left.appendChild(gust);
      body.appendChild(left);
      var viz = h('div', 'tile__viz');
      body.appendChild(viz);
      t.appendChild(body);
      Chart.compass(viz, cur.wind_direction_10m, { size: 104, label: WX.windDir(cur.wind_direction_10m) });
    }));

    /* 2 — Humidity + dew point */
    frag.appendChild(tile('Humidity', ICONS.drop, function (t) {
      var body = h('div', 'tile__body');
      var left = h('div');
      var v = h('div', 'tile__value', String(Math.round(cur.relative_humidity_2m)));
      v.appendChild(h('sup', null, '%'));
      left.appendChild(v);
      var dp = cur.dew_point_2m != null ? cur.dew_point_2m : WX.dewPoint(cur.temperature_2m, cur.relative_humidity_2m);
      left.appendChild(h('div', 'tile__note', 'Dew point ' + WX.tempText(dp, unit) + '° · ' + WX.dewNote(dp)));
      var hs = m.hours.slice(0, 24).map(function (x) { return x.humidity; })
        .filter(function (v) { return v != null; });
      var hn = h('div', 'tile__note', hs.length
        ? 'Next 24 h ' + Math.round(Math.min.apply(null, hs)) + '–' + Math.round(Math.max.apply(null, hs)) + '%'
        : WX.humidityNote(cur.relative_humidity_2m));
      hn.style.opacity = '.7';
      left.appendChild(hn);
      body.appendChild(left);
      var viz = h('div', 'tile__viz');
      body.appendChild(viz);
      t.appendChild(body);
      Chart.arcGauge(viz, {
        value: cur.relative_humidity_2m / 100, size: 104, center: Math.round(cur.relative_humidity_2m) + '%',
        centerSize: 18, caption: 'RH', stops: [['#7cc4ff'], ['#4f9ee8']],
        aria: 'Relative humidity ' + Math.round(cur.relative_humidity_2m) + ' percent'
      });
    }));

    /* 3 — UV index */
    var uvNow = m.hours[0] ? m.hours[0].uv : null;
    if (uvNow == null) uvNow = m.today.uvMax;
    var uvBand = WX.uv(uvNow);
    frag.appendChild(tile('UV index', ICONS.sun, function (t) {
      var body = h('div', 'tile__body');
      var left = h('div');
      left.appendChild(h('div', 'tile__value', uvNow == null ? '—' : String(Math.round(uvNow * 10) / 10)));
      left.appendChild(h('div', 'tile__note', uvBand ? uvBand.label : '—'));
      var note = h('div', 'tile__note', 'Peak today ' + (m.today.uvMax == null ? '—' : Math.round(m.today.uvMax * 10) / 10));
      note.style.opacity = '.7';
      left.appendChild(note);
      body.appendChild(left);
      var viz = h('div', 'tile__viz');
      body.appendChild(viz);
      t.appendChild(body);
      Chart.arcGauge(viz, {
        value: uvNow == null ? 0 : Math.min(1, uvNow / 11), size: 104,
        center: uvNow == null ? '—' : String(Math.round(uvNow * 10) / 10), centerSize: 20, caption: 'UV',
        stops: [['#4ade80'], ['#facc15'], ['#fb923c'], ['#f87171']],
        aria: 'UV index ' + uvNow
      });
    }));

    /* 4 — Air quality */
    var aqiVal = d.air && d.air.us_aqi != null ? d.air.us_aqi : null;
    var aqiBand = WX.aqi(aqiVal);
    frag.appendChild(tile('Air quality', ICONS.air, function (t) {
      var body = h('div', 'tile__body');
      var left = h('div');
      left.appendChild(h('div', 'tile__value', aqiVal == null ? '—' : String(Math.round(aqiVal))));
      left.appendChild(h('div', 'tile__note', aqiBand ? aqiBand.label : 'No data'));
      if (d.air) {
        var pm = h('div', 'tile__note',
          'PM2.5 ' + (d.air.pm2_5 == null ? '—' : Math.round(d.air.pm2_5 * 10) / 10) +
          ' · PM10 ' + (d.air.pm10 == null ? '—' : Math.round(d.air.pm10 * 10) / 10));
        pm.style.opacity = '.7';
        left.appendChild(pm);
      }
      body.appendChild(left);
      var viz = h('div', 'tile__viz');
      body.appendChild(viz);
      t.appendChild(body);
      Chart.ring(viz, {
        value: aqiVal == null ? 0 : Math.min(1, aqiVal / 300), size: 104,
        color: aqiBand ? aqiBand.color : '#4ade80',
        center: aqiVal == null ? '—' : String(Math.round(aqiVal)), centerSize: 20, caption: 'US AQI',
        aria: 'US air quality index ' + aqiVal
      });
    }));

    /* 5 — Pressure */
    frag.appendChild(tile('Pressure', ICONS.gauge, function (t) {
      var body = h('div', 'tile__body');
      var left = h('div');
      var pv = m.pressNow;
      var v = h('div', 'tile__value', pv == null ? '—' : String(Math.round(pv)));
      v.appendChild(h('sup', null, 'hPa'));
      left.appendChild(v);
      left.appendChild(h('div', 'tile__note', WX.pressureNote(pv, m.pressTrend)));
      body.appendChild(left);
      var viz = h('div', 'tile__viz');
      body.appendChild(viz);
      t.appendChild(body);
      Chart.sparkline(viz, m.pressSeries.length > 2 ? m.pressSeries : [1010, 1011, 1012, 1013],
        { width: 96, height: 40, aria: 'Pressure trend over the next hours' });
    }));

    /* 6 — Visibility */
    var vis = m.hours[0] && state.data.hourly.visibility ? state.data.hourly.visibility[m.nowIdx] : null;
    frag.appendChild(tile('Visibility', ICONS.eye, function (t) {
      var body = h('div', 'tile__body');
      var left = h('div');
      var dv = WX.distance(vis, unit);
      var v = h('div', 'tile__value', dv == null ? '—' : (dv >= 10 ? String(Math.round(dv)) : String(Math.round(dv * 10) / 10)));
      v.appendChild(h('sup', null, WX.distanceUnit(unit)));
      left.appendChild(v);
      left.appendChild(h('div', 'tile__note', WX.visibilityNote(vis)));
      body.appendChild(left);
      t.appendChild(body);
      var meter = h('div', 'tile__meter');
      var fill = h('i');
      var pct = vis == null ? 0 : Math.min(100, (vis / 30000) * 100);
      fill.style.width = pct.toFixed(1) + '%';
      meter.appendChild(fill);
      t.appendChild(meter);
    }));

    /* 7 — Precipitation outlook */
    var next24 = m.hours.slice(0, 24);
    var totalPrecip = next24.reduce(function (a, hh) { return a + (hh.precip || 0); }, 0);
    var maxPop = next24.reduce(function (a, hh) { return Math.max(a, hh.pop || 0); }, 0);
    frag.appendChild(tile('Precipitation', ICONS.rain, function (t) {
      var body = h('div', 'tile__body');
      var left = h('div');
      var v = h('div', 'tile__value', String(Math.round(WX.precip(totalPrecip, unit) * 100) / 100));
      v.appendChild(h('sup', null, WX.precipUnit(unit)));
      left.appendChild(v);
      left.appendChild(h('div', 'tile__note', 'Next 24 h · peak chance ' + Math.round(maxPop) + '%'));
      left.appendChild(h('div', 'tile__note', WX.precipNote(totalPrecip)));
      body.appendChild(left);
      var viz = h('div', 'tile__viz');
      body.appendChild(viz);
      t.appendChild(body);
      Chart.arcGauge(viz, {
        value: maxPop / 100, size: 104, center: Math.round(maxPop) + '%', centerSize: 18,
        caption: 'CHANCE', stops: [['#7cc4ff'], ['#3b82f6']], aria: 'Peak chance of precipitation'
      });
    }));

    /* 8 — Sun */
    frag.appendChild(tile('Sun', ICONS.sunpath, function (t) {
      var viz = h('div', 'tile__viz');
      viz.style.width = '100%';
      viz.style.display = 'block';
      t.appendChild(viz);
      var row = h('div', 'tile__cols');
      var a = h('div');
      a.appendChild(h('div', 'tile__note', 'Daylight'));
      a.appendChild(h('div', 'tile__value tile__value--sm', WX.durationText(WX.daylightLength(m.sunrise, m.sunset))));
      var b = h('div');
      b.appendChild(h('div', 'tile__note', 'Solar noon'));
      b.appendChild(h('div', 'tile__value tile__value--sm',
        m.sunrise && m.sunset ? WX.hhmm((m.sunrise + m.sunset) / 2, m.off) : '—'));
      row.appendChild(a); row.appendChild(b);
      t.appendChild(row);
      t.appendChild(h('div', 'tile__note', m.progress >= 1 ? 'The sun has set'
        : m.progress <= 0 ? 'The sun is below the horizon'
        : Math.round(m.progress * 100) + '% of daylight elapsed'));
      var box = viz;
      requestAnimationFrame(function () {
        Chart.sunArc(box, {
          width: Math.max(200, box.clientWidth || 220), height: 92,
          progress: m.progress,
          left: m.sunrise ? WX.hhmm(m.sunrise, m.off) : '',
          right: m.sunset ? WX.hhmm(m.sunset, m.off) : '',
          aria: 'Sun position through the day'
        });
      });
    }));

    grid.appendChild(frag);
  }

  function renderFooter(m) {
    setText('footCoords', (m.cur ? '' : '') +
      Math.abs(state.data.place.latitude).toFixed(2) + '°' + (state.data.place.latitude >= 0 ? 'N' : 'S') +
      ' ' + Math.abs(state.data.place.longitude).toFixed(2) + '°' + (state.data.place.longitude >= 0 ? 'E' : 'W') +
      (state.data.timezone ? ' · ' + state.data.timezone : ''));

    var badge = $('sourceBadge');
    var kind = state.data.source === 'live' ? 'live' : state.data.source === 'cache' ? 'cache' : 'demo';
    badge.textContent = kind === 'live' ? 'live' : kind === 'cache' ? 'cached' : 'offline model';
    badge.setAttribute('data-kind', kind);
    badge.title = kind === 'live' ? 'Live data from Open-Meteo'
      : kind === 'cache' ? 'Showing the last saved data — network unavailable'
      : 'Network unavailable — showing a locally generated estimate';
  }

  function updateAge() {
    if (!state.data || !state.data.fetchedAt) return;
    setText('updateAge', WX.relative(state.data.fetchedAt, Date.now()));
  }

  /* ── Loading / error states ───────────────────────────────────────── */
  function showSkeleton() {
    var grid = $('details');
    grid.innerHTML = '';
    for (var i = 0; i < 8; i++) {
      var t = h('article', 'tile');
      t.appendChild(h('div', 'skel skel--line')).style.width = '42%';
      var big = h('div', 'skel skel--big');
      big.style.marginTop = '18px';
      t.appendChild(big);
      grid.appendChild(t);
    }
    var hourly = $('hourly');
    hourly.innerHTML = '';
    for (var j = 0; j < 12; j++) {
      var c = h('div', 'hour');
      var s = h('div', 'skel');
      s.style.width = '46px'; s.style.height = '64px';
      c.appendChild(s);
      hourly.appendChild(c);
    }
    var daily = $('daily');
    daily.innerHTML = '';
    for (var k = 0; k < 7; k++) {
      var r = h('div', 'day');
      var s2 = h('div', 'skel skel--line');
      s2.style.gridColumn = '1 / -1';
      r.appendChild(s2);
      daily.appendChild(r);
    }
    setText('tempNow', '—');
    setText('condText', 'Loading…');
  }

  /* ── Data flow ────────────────────────────────────────────────────── */
  var inflight = 0;
  function load(place, opts) {
    opts = opts || {};
    var token = ++inflight;
    state.loading = true;
    var btn = $('refreshBtn');
    if (btn) btn.classList.add('is-spinning');
    if (opts.skeleton) showSkeleton();

    return Api.load(place).then(function (data) {
      if (token !== inflight) return;
      state.data = data;
      state.place = data.place;
      renderAll();
      updateAge();
      if (data.source === 'demo' && !opts.quiet) {
        toast('Offline — showing a locally generated forecast.');
      } else if (data.source === 'cache' && !opts.quiet) {
        toast('Network unavailable — showing the last saved update.');
      }
    }).catch(function (err) {
      if (token !== inflight) return;
      toast('Could not load weather data: ' + (err && err.message ? err.message : err), 'error');
    }).finally(function () {
      if (token === inflight) {
        state.loading = false;
        if (btn) btn.classList.remove('is-spinning');
      }
    });
  }

  /* ── Search combobox ──────────────────────────────────────────────── */
  function setupSearch() {
    var input = $('searchInput'), list = $('searchList'), clearBtn = $('searchClear'), spin = $('searchSpin');
    var timer = 0, ctl = null, results = [], active = -1, lastQuery = '';

    function close() {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
      active = -1;
    }
    function open() {
      list.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
    function render() {
      list.innerHTML = '';
      if (!results.length) {
        var empty = h('li', 'search__empty', 'No matching places.');
        list.appendChild(empty);
        return;
      }
      results.forEach(function (r, i) {
        var li = h('li', 'search__opt');
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', i === active ? 'true' : 'false');
        li.setAttribute('data-i', String(i));
        var f = h('span', 'flag', flag(r.countryCode));
        li.appendChild(f);
        var b = h('b', null, r.name);
        li.appendChild(b);
        var sub = [r.admin1 && r.admin1 !== r.name ? r.admin1 : '', r.country || ''].filter(Boolean).join(', ');
        li.appendChild(h('small', null, sub));
        li.addEventListener('pointerdown', function (e) { e.preventDefault(); choose(i); });
        list.appendChild(li);
      });
    }
    function choose(i) {
      var r = results[i];
      if (!r) return;
      close();
      input.value = '';
      clearBtn.hidden = true;
      load(r, { skeleton: true });
      toast('Showing ' + placeLabel(r) + '.');
      input.blur();
    }
    function run(query) {
      lastQuery = query;
      if (ctl) ctl.abort();
      ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      spin.hidden = false;
      Api.search(query, ctl ? ctl.signal : undefined).then(function (list2) {
        if (query !== lastQuery) return;
        spin.hidden = true;
        results = list2;
        active = list2.length ? 0 : -1;
        render();
        open();
      }).catch(function (err) {
        if (err && err.name === 'AbortError') return;
        spin.hidden = true;
        results = [];
        render();
        open();
      });
    }

    input.addEventListener('input', function () {
      var q = input.value.trim();
      clearBtn.hidden = !q;
      clearTimeout(timer);
      if (q.length < 2) { close(); return; }
      timer = setTimeout(function () { run(q); }, 230);
    });
    input.addEventListener('focus', function () {
      if (results.length && input.value.trim().length >= 2) open();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (list.hidden && results.length) { open(); return; }
        e.preventDefault();
        if (!results.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        render();
        var sel = list.querySelector('[aria-selected="true"]');
        if (sel) sel.scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (!list.hidden && active >= 0) { e.preventDefault(); choose(active); }
      } else if (e.key === 'Escape') {
        close();
        if (input.value) { input.value = ''; clearBtn.hidden = true; }
        else input.blur();
      }
    });
    clearBtn.addEventListener('click', function () {
      input.value = '';
      clearBtn.hidden = true;
      close();
      input.focus();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!$('search').contains(e.target)) close();
    });
    global.addEventListener('keydown', function (e) {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) &&
          document.activeElement !== input) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  /* ── Controls ─────────────────────────────────────────────────────── */
  function setupControls() {
    var c = $('unitC'), f = $('unitF');
    function setUnit(u) {
      if (state.unit === u) return;
      state.unit = u;
      c.classList.toggle('is-on', u === 'C');
      f.classList.toggle('is-on', u === 'F');
      c.setAttribute('aria-pressed', u === 'C' ? 'true' : 'false');
      f.setAttribute('aria-pressed', u === 'F' ? 'true' : 'false');
      try { localStorage.setItem('skylight.unit', u); } catch (e) {}
      renderAll();
    }
    c.addEventListener('click', function () { setUnit('C'); });
    f.addEventListener('click', function () { setUnit('F'); });

    $('themeBtn').addEventListener('click', function () {
      var next = state.theme === 'dark' ? 'light' : 'dark';
      state.theme = next;
      root.setAttribute('data-theme', next);
      this.setAttribute('aria-label', next === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      try { localStorage.setItem('skylight.theme', next); } catch (e) {}
      renderAll();
    });

    $('refreshBtn').addEventListener('click', function () {
      load(state.place || DEFAULTS[0], { quiet: true });
    });

    $('locateBtn').addEventListener('click', function () {
      var btn = this;
      btn.disabled = true;
      toast('Requesting your location…');
      Api.locate().then(function (pos) {
        return load({
          name: 'My location', country: '', countryCode: '', admin1: '',
          latitude: pos.latitude, longitude: pos.longitude, timezone: null
        }, { skeleton: true });
      }).catch(function (err) {
        toast(err.message || 'Could not determine your location.', 'error');
      }).finally(function () { btn.disabled = false; });
    });

    $('hourlyToggle').addEventListener('click', function () {
      state.hourlyDetailed = !state.hourlyDetailed;
      this.setAttribute('aria-pressed', state.hourlyDetailed ? 'true' : 'false');
      if (state.model) renderHourly(state.model);
    });

    $('brand').addEventListener('click', function (e) {
      e.preventDefault();
      load(state.place || DEFAULTS[0], { quiet: true });
    });

    /* Sticky header shadow */
    var topbar = document.querySelector('.topbar');
    var onScroll = function () {
      topbar.classList.toggle('is-stuck', global.scrollY > 8);
    };
    global.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    /* Re-draw responsive charts on resize (debounced). */
    var rt = 0;
    global.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () { if (state.model) renderAll(); }, 220);
    });

    /* Refresh when the tab becomes visible again, and on a timer. */
    setInterval(updateAge, 30000);
    setInterval(function () {
      if (!document.hidden && state.place) load(state.place, { quiet: true });
    }, 10 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && Date.now() - (state.data ? state.data.fetchedAt : 0) > 6 * 60 * 1000 && state.place) {
        load(state.place, { quiet: true });
      }
    });
  }

  /* ── Boot ─────────────────────────────────────────────────────────── */
  function boot() {
    try {
      var savedTheme = localStorage.getItem('skylight.theme');
      if (savedTheme) state.theme = savedTheme;
      else if (global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches) state.theme = 'light';
      var savedUnit = localStorage.getItem('skylight.unit');
      if (savedUnit) state.unit = savedUnit;
    } catch (e) {}
    root.setAttribute('data-theme', state.theme);
    $('unitC').classList.toggle('is-on', state.unit === 'C');
    $('unitF').classList.toggle('is-on', state.unit === 'F');
    $('unitC').setAttribute('aria-pressed', state.unit === 'C' ? 'true' : 'false');
    $('unitF').setAttribute('aria-pressed', state.unit === 'F' ? 'true' : 'false');

    state.effects = global.WXEffects.create($('skyFx'));
    state.effects.start();

    setupSearch();
    setupControls();
    showSkeleton();

    var place = Api.readPlace();
    if (!place) {
      var zone = 'UTC';
      try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}
      place = ZONE_CITY[zone] || DEFAULTS[0];
    }
    state.place = place;
    load(place, { skeleton: true, quiet: true });
  }

  /* Expose a small surface for the self-test harness. */
  global.Skylight = {
    state: state,
    renderAll: renderAll,
    buildModel: buildModel,
    load: load,
    setPlace: function (p) { state.place = p; return load(p, { skeleton: true, quiet: true }); },
    /** Inject a prepared dataset (used by tools/states.js to exercise every sky). */
    inject: function (data) {
      state.data = data;
      state.place = data.place;
      renderAll();
      updateAge();
      return data;
    },
    places: DEFAULTS,
    zoneCity: ZONE_CITY
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
