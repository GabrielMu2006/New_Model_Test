const cities = {
  Amsterdam: { country: 'Netherlands', temp: 18, feels: 17, condition: 'Partly cloudy', summary: 'Clouds giving way to a bright and mild afternoon.', wind: 14, dir: 'West · W', humidity: 68, dew: 12, uv: 3, rain: 18, sunrise: '6:24 AM', sunset: '8:51 PM', offset: 2, hourly: [18,19,20,20,19,17,16], daily: [[20,13],[19,12],[18,11],[21,13],[22,14],[19,12],[18,11]] },
  Copenhagen: { country: 'Denmark', temp: 15, feels: 13, condition: 'Light showers', summary: 'A passing shower, then cooler with soft coastal winds.', wind: 21, dir: 'Southwest · SW', humidity: 76, dew: 11, uv: 2, rain: 64, sunrise: '5:58 AM', sunset: '8:22 PM', offset: 2, hourly: [15,15,14,14,13,13,12], daily: [[16,10],[15,9],[17,10],[18,11],[16,9],[17,10],[19,12]] },
  Lisbon: { country: 'Portugal', temp: 24, feels: 25, condition: 'Clear skies', summary: 'Warm sunshine throughout the day with a gentle ocean breeze.', wind: 11, dir: 'Northwest · NW', humidity: 51, dew: 13, uv: 7, rain: 2, sunrise: '6:48 AM', sunset: '8:17 PM', offset: 1, hourly: [24,26,27,27,25,23,21], daily: [[27,18],[28,18],[27,17],[25,17],[26,18],[29,19],[30,20]] },
  Tokyo: { country: 'Japan', temp: 27, feels: 30, condition: 'Warm & hazy', summary: 'A warm, humid evening with haze lingering over the city.', wind: 8, dir: 'Southeast · SE', humidity: 74, dew: 22, uv: 5, rain: 28, sunrise: '5:09 AM', sunset: '6:12 PM', offset: 9, hourly: [27,26,25,25,24,24,23], daily: [[29,23],[30,24],[28,22],[29,23],[31,24],[30,23],[28,22]] },
  Vancouver: { country: 'Canada', temp: 12, feels: 10, condition: 'Overcast', summary: 'Low cloud cover with brighter breaks developing toward midday.', wind: 17, dir: 'East · E', humidity: 81, dew: 9, uv: 2, rain: 41, sunrise: '6:16 AM', sunset: '8:04 PM', offset: -7, hourly: [12,12,13,14,15,14,13], daily: [[15,9],[16,10],[14,9],[17,10],[18,11],[16,10],[15,9]] }
};

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
let cityName = 'Amsterdam';
let fahrenheit = false;
let view = 'hourly';

function convert(c) { return fahrenheit ? Math.round(c * 9 / 5 + 32) : c; }
function icon(type, rain = false) {
  if (rain) return `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M12 30a8 8 0 0 1 2-15.7A12 12 0 0 1 37 18a6 6 0 0 1-2 11.7" fill="#e6ebe7" stroke="#496760" stroke-width="1.5"/><path d="m17 35-2 5m10-5-2 5m10-5-2 5" stroke="#668ba0" stroke-width="2" stroke-linecap="round"/></svg>`;
  if (type === 'sun') return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="9" fill="#e9a563"/><g stroke="#cf8550" stroke-width="1.5" stroke-linecap="round"><path d="M24 7v5m0 24v5M7 24h5m24 0h5M12 12l4 4m16 16 4 4m0-24-4 4M16 32l-4 4"/></g></svg>`;
  return `<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="31" cy="17" r="9" fill="#edaa67"/><path d="M11 33a7 7 0 0 1 2-13.7A10 10 0 0 1 32 22a6 6 0 0 1-1 11Z" fill="#eef1ec" stroke="#73807c" stroke-width="1.2"/></svg>`;
}

function updateTime() {
  const d = new Date(Date.now() + (cities[cityName].offset * 60 + new Date().getTimezoneOffset()) * 60000);
  $('#local-time').textContent = new Intl.DateTimeFormat('en-US', { weekday:'long', hour:'numeric', minute:'2-digit' }).format(d);
}

function renderForecast() {
  const c = cities[cityName];
  const list = $('#forecast-list');
  if (view === 'hourly') {
    const start = new Date().getHours();
    list.innerHTML = c.hourly.map((temp, i) => {
      const label = i === 0 ? 'Now' : new Intl.DateTimeFormat('en-US', {hour:'numeric'}).format(new Date(2020,1,1,(start+i*2)%24));
      const rainy = c.rain > 35 && i > 1 && i < 5;
      return `<article class="forecast-item ${i===0?'current':''}"><span class="time">${label}</span><div class="forecast-icon">${icon(i===3?'sun':'cloud', rainy)}</div><strong class="temp">${convert(temp)}°</strong><span class="meta">${rainy ? Math.min(c.rain + i * 4, 88) + '% rain' : i===0 ? 'Feels right' : '—'}</span></article>`;
    }).join('');
  } else {
    const days = ['Today','Tomorrow',...Array.from({length:5},(_,i)=>new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(new Date(Date.now()+(i+2)*86400000)))];
    list.innerHTML = c.daily.map((temps,i)=>`<article class="forecast-item ${i===0?'current':''}"><span class="time">${days[i]}</span><div class="forecast-icon">${icon(i===2||i===4?'sun':'cloud', c.rain>45&&i<2)}</div><strong class="temp">${convert(temps[0])}°</strong><span class="meta">Low ${convert(temps[1])}°</span></article>`).join('');
  }
}

function render() {
  const c = cities[cityName];
  $('#location-title').textContent = cityName;
  $('#condition').textContent = c.condition;
  $('#current-temp').textContent = convert(c.temp);
  $('#feels-like').textContent = `Feels like ${convert(c.feels)}°`;
  $('#summary').textContent = c.summary;
  $('#wind').innerHTML = `${fahrenheit ? Math.round(c.wind * .621371) : c.wind} <small>${fahrenheit ? 'mph' : 'km/h'}</small>`;
  $('#wind-dir').textContent = c.dir;
  $('#humidity').innerHTML = `${c.humidity}<small>%</small>`;
  $('#dew-point').textContent = `Dew point ${convert(c.dew)}°`;
  $('#uv').innerHTML = `${c.uv} <small>${c.uv < 4 ? 'Low' : c.uv < 7 ? 'Moderate' : 'High'}</small>`;
  $('#rain').innerHTML = `${c.rain}<small>%</small>`;
  $('#sunrise').textContent = c.sunrise;
  $('#sunset').textContent = c.sunset;
  $('#temp-unit').textContent = '°';
  updateTime(); renderForecast();
}

function showResults(query = '') {
  const results = Object.keys(cities).filter(name => name.toLowerCase().includes(query.toLowerCase()));
  const box = $('#search-results');
  box.innerHTML = results.length ? results.map(name => `<button class="search-result" role="option" data-city="${name}">${name}<small>${cities[name].country}</small></button>`).join('') : `<div class="search-result">No saved cities found</div>`;
  box.hidden = false;
  $('#city-search').setAttribute('aria-expanded','true');
}

$('#city-search').addEventListener('input', e => showResults(e.target.value));
$('#city-search').addEventListener('focus', e => showResults(e.target.value));
$('#search-results').addEventListener('click', e => {
  const button = e.target.closest('[data-city]');
  if (!button) return;
  cityName = button.dataset.city; $('#city-search').value = ''; $('#search-results').hidden = true; render();
});
document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) { $('#search-results').hidden = true; $('#city-search').setAttribute('aria-expanded','false'); } });
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase()==='k') { e.preventDefault(); $('#city-search').focus(); } if (e.key==='Escape') { $('#search-results').hidden = true; $('#city-search').blur(); } });
$('#unit-toggle').addEventListener('click', () => { fahrenheit = !fahrenheit; $$('#unit-toggle span').forEach((s,i)=>s.classList.toggle('active', fahrenheit ? i===1 : i===0)); $('#unit-toggle').ariaLabel = `Switch to ${fahrenheit ? 'Celsius' : 'Fahrenheit'}`; render(); });
$$('.tab').forEach(tab => tab.addEventListener('click', () => { view = tab.dataset.view; $$('.tab').forEach(t => { t.classList.toggle('active',t===tab); t.setAttribute('aria-selected',t===tab); }); renderForecast(); }));
$('#location-button').addEventListener('click', () => showToast('Location access is unavailable in this demo'));
$('.avatar').addEventListener('click', () => showToast('Your weather preferences are up to date'));
let toastTimer;
function showToast(message) { const toast=$('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),2600); }
render();
setInterval(updateTime, 30000);
