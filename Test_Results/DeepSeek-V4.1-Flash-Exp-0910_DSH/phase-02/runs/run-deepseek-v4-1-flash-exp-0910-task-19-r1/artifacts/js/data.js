/* ==========================================================================
 * data.js — Solar System catalogue.
 *
 * SOURCE OF VALUES
 *   Physical radii, orbital semi-major axes, eccentricities, inclinations and
 *   sidereal periods are the standard published values (NASA planetary fact
 *   sheets / JPL "Approximate Positions of the Planets", J2000 epoch).
 *   Mean longitudes and arguments of perihelion are rounded J2000 values; the
 *   simulation is a schematic orrery, not an ephemeris generator (see README
 *   "Fidelity & limitations").
 *
 * UNITS
 *   a / radiusAU : AU            period : days (sidereal)
 *   inc          : degrees       radiusKm : km
 *
 * DISPLAY KNOBS (deliberately separate from the physical values)
 *   schematicBase : on-screen radius, in pixels at zoom 1, used by the WIDE
 *                   (Solar System) view. Real radii are 1e-5..4.6e-3 AU, i.e.
 *                   sub-pixel there, so bodies are magnified for legibility.
 *                   The values are proportional to (r/rEarth)^0.55, so the
 *                   ordering and rough proportions of the planets survive.
 *                   The renderer crossfades from this to a strict true-ratio
 *                   model as the camera zooms onto a planet.
 *   ring          : [inner, outer] ring radii as a multiple of the body radius.
 *   phase/node/inc: orientation of a moon's circular orbit, in degrees.
 * ========================================================================== */
(function (global) {
  'use strict';

  // km -> AU
  var KM = 1 / 149597870.7;

  var SUN = {
    id: 'sun',
    name: 'Sun',
    kind: 'star',
    radiusKm: 696340,
    color: '#ffd257',
    glow: '#ff9a1f',
    rotDays: 25.38,
    facts: {
      'Type': 'G2V main-sequence star',
      'Diameter': '1,392,700 km (109 × Earth)',
      'Mass': '1.989 × 10^30 kg (333,000 × Earth)',
      'Surface temp.': '5,505 °C',
      'Core temp.': '~15,000,000 °C',
      'Rotation': '25.4 days (equator)',
      'Age': '~4.6 billion years',
      'Composition': '73% hydrogen, 25% helium'
    },
    blurb: 'The Sun holds 99.86% of the mass of the Solar System. Everything ' +
           'else — planets, moons, asteroids, comets — orbits around it.'
  };

  // a, e, inc, w (longitude of perihelion), M0 (mean anomaly, deg, J2000)
  var PLANETS = [
    {
      id: 'mercury', name: 'Mercury', kind: 'planet', radiusKm: 2439.7,
      a: 0.38709927, e: 0.20563593, inc: 7.00497902, w: 77.45779628, M0: 174.7948,
      period: 87.9691, color: '#b9b2a8', glow: '#e2d8cb', rotDays: 58.646, tilt: 0.034,
      schematicBase: 0.62,
      facts: {
        'Diameter': '4,879 km',
        'Mass': '0.055 × Earth',
        'Orbital period': '88.0 days',
        'Rotation': '58.6 days',
        'Mean distance': '0.387 AU (58.0 million km)',
        'Surface temp.': '−173 °C to 427 °C',
        'Moons': '0',
        'Orbital speed': '47.4 km/s (fastest planet)'
      },
      blurb: 'The smallest planet and the closest to the Sun. It has almost no ' +
             'atmosphere, so its surface swings between scorching day and ' +
             'freezing night.'
    },
    {
      id: 'venus', name: 'Venus', kind: 'planet', radiusKm: 6051.8,
      a: 0.72333566, e: 0.00677672, inc: 3.39467605, w: 131.60246718, M0: 50.1150,
      period: 224.701, color: '#e8c07a', glow: '#ffe6b0', rotDays: -243.025, tilt: 177.4,
      schematicBase: 0.95,
      facts: {
        'Diameter': '12,104 km',
        'Mass': '0.815 × Earth',
        'Orbital period': '224.7 days',
        'Rotation': '243 days, retrograde',
        'Mean distance': '0.723 AU (108.2 million km)',
        'Surface temp.': '464 °C (hottest planet)',
        'Moons': '0',
        'Atmosphere': '96% CO₂, 92 × Earth pressure'
      },
      blurb: 'A runaway greenhouse world. Venus rotates backwards and so slowly ' +
             'that its day is longer than its year.'
    },
    {
      id: 'earth', name: 'Earth', kind: 'planet', radiusKm: 6371.0,
      a: 1.00000261, e: 0.01671123, inc: -0.00001531, w: 102.93768193, M0: 357.5291,
      period: 365.256, color: '#4a90d9', glow: '#8ec8ff', rotDays: 0.99727, tilt: 23.44,
      schematicBase: 1.0,
      facts: {
        'Diameter': '12,742 km',
        'Mass': '5.972 × 10^24 kg',
        'Orbital period': '365.26 days',
        'Rotation': '23h 56m',
        'Mean distance': '1.000 AU (149.6 million km)',
        'Mean temp.': '15 °C',
        'Moons': '1 (the Moon)',
        'Orbital speed': '29.8 km/s'
      },
      blurb: 'The only planet known to host life, and the only one where liquid ' +
             'water is stable across most of the surface.'
    },
    {
      id: 'mars', name: 'Mars', kind: 'planet', radiusKm: 3389.5,
      a: 1.52371034, e: 0.09339410, inc: 1.84969142, w: 336.05637041, M0: 19.3730,
      period: 686.980, color: '#d1603d', glow: '#ff9a72', rotDays: 1.02595, tilt: 25.19,
      schematicBase: 0.72,
      facts: {
        'Diameter': '6,779 km',
        'Mass': '0.107 × Earth',
        'Orbital period': '687.0 days',
        'Rotation': '24h 37m',
        'Mean distance': '1.524 AU (227.9 million km)',
        'Mean temp.': '−63 °C',
        'Moons': '2 (Phobos, Deimos)',
        'Highest peak': 'Olympus Mons, 21.9 km'
      },
      blurb: 'The rusty planet. Mars hosts the tallest volcano and the deepest ' +
             'canyon in the Solar System.'
    },
    {
      id: 'jupiter', name: 'Jupiter', kind: 'planet', radiusKm: 69911,
      a: 5.20288700, e: 0.04838624, inc: 1.30439695, w: 14.72847983, M0: 20.0202,
      period: 4332.589, color: '#d9a066', glow: '#f5d2a8', rotDays: 0.41354, tilt: 3.13,
      schematicBase: 2.9,
      facts: {
        'Diameter': '139,822 km',
        'Mass': '317.8 × Earth',
        'Orbital period': '11.86 years',
        'Rotation': '9h 56m (fastest planet)',
        'Mean distance': '5.202 AU (778.5 million km)',
        'Cloud-top temp.': '−145 °C',
        'Moons': '95 known (4 shown)',
        'Great Red Spot': 'Storms wider than Earth'
      },
      blurb: 'The giant of the Solar System — more massive than every other ' +
             'planet combined. Its gravity shepherds the asteroid belt.'
    },
    {
      id: 'saturn', name: 'Saturn', kind: 'planet', radiusKm: 58232,
      a: 9.53667594, e: 0.05386179, inc: 2.48599187, w: 92.59887831, M0: 317.0207,
      period: 10759.22, color: '#e3d3a3', glow: '#fff5cf', rotDays: 0.44401, tilt: 26.73,
      ring: [1.24, 2.30],
      schematicBase: 2.45,
      facts: {
        'Diameter': '116,464 km',
        'Mass': '95.2 × Earth',
        'Orbital period': '29.46 years',
        'Rotation': '10h 33m',
        'Mean distance': '9.537 AU (1.43 billion km)',
        'Cloud-top temp.': '−178 °C',
        'Moons': '274 known (none shown)',
        'Rings': 'Mostly water ice, 282,000 km wide'
      },
      blurb: 'Famous for its rings, which are only tens of metres thick on ' +
             'average. Saturn is less dense than water.'
    },
    {
      id: 'uranus', name: 'Uranus', kind: 'planet', radiusKm: 25362,
      a: 19.18916464, e: 0.04725744, inc: 0.77263783, w: 170.95427630, M0: 142.2386,
      period: 30685.4, color: '#a8dfe8', glow: '#d8f6ff', rotDays: -0.71833, tilt: 97.77,
      ring: [1.60, 1.95],
      schematicBase: 1.55,
      facts: {
        'Diameter': '50,724 km',
        'Mass': '14.5 × Earth',
        'Orbital period': '84.01 years',
        'Rotation': '17h 14m, retrograde',
        'Mean distance': '19.19 AU (2.87 billion km)',
        'Cloud-top temp.': '−224 °C (coldest)',
        'Moons': '28 known (none shown)',
        'Axial tilt': '97.8° — it rolls on its side'
      },
      blurb: 'An ice giant tipped on its side, probably by a giant impact long ' +
             'ago. Its poles take turns facing the Sun for 42 years each.'
    },
    {
      id: 'neptune', name: 'Neptune', kind: 'planet', radiusKm: 24622,
      a: 30.06992276, e: 0.00859048, inc: 1.77004347, w: 44.96476227, M0: 256.2250,
      period: 60189.0, color: '#4062c8', glow: '#8fa8ff', rotDays: 0.67125, tilt: 28.32,
      schematicBase: 1.5,
      facts: {
        'Diameter': '49,244 km',
        'Mass': '17.1 × Earth',
        'Orbital period': '164.8 years',
        'Rotation': '16h 6m',
        'Mean distance': '30.07 AU (4.50 billion km)',
        'Cloud-top temp.': '−214 °C',
        'Moons': '16 known (none shown)',
        'Winds': 'Up to 2,100 km/h — fastest known'
      },
      blurb: 'The outermost planet, found by mathematics before it was seen: ' +
             'its position was predicted from irregularities in Uranus\u2019 orbit.'
    },
    {
      id: 'pluto', name: 'Pluto', kind: 'dwarf', radiusKm: 1188.3,
      a: 39.48211675, e: 0.24882730, inc: 17.14001206, w: 224.06891629, M0: 14.882,
      period: 90560.0, color: '#c8b09a', glow: '#ecd9c4', rotDays: 6.3872, tilt: 122.5,
      schematicBase: 0.62,
      facts: {
        'Diameter': '2,377 km',
        'Mass': '0.0022 × Earth',
        'Orbital period': '248.0 years',
        'Rotation': '6.39 days',
        'Mean distance': '39.48 AU',
        'Mean temp.': '−229 °C',
        'Moons': '5 (Charon is half its size)',
        'Status': 'Dwarf planet (reclassified 2006)'
      },
      blurb: 'Included as a bonus body — it is a dwarf planet, not one of the ' +
             'eight planets, and is drawn with a dashed orbit to make that clear.'
    }
  ];

  function moon(o) {
    o.kind = 'moon';
    o.radiusAU = o.radiusKm * KM;
    if (!o.schematicBase) o.schematicBase = 0.95;
    return o;
  }

  var MOONS = [
    moon({
      id: 'moon', name: 'Moon', parent: 'earth', radiusKm: 1737.4,
      aKm: 384400, period: 27.321661, phase: 218.32, inc: 5.145, node: 125.08,
      color: '#cfcfcf', glow: '#f0f0f0', rotDays: 27.321661, tidallyLocked: true,
      facts: {
        'Diameter': '3,475 km',
        'Mass': '0.0123 × Earth',
        'Orbital period': '27.32 days (sidereal)',
        'Distance from Earth': '384,400 km',
        'Rotation': '27.32 days — tidally locked',
        'Surface gravity': '1.62 m/s² (1/6 of Earth)',
        'Recession': 'Drifting away at 3.8 cm per year',
        'Visits': '12 crewed landings (Apollo, 1969-1972)'
      },
      blurb: 'Always shows the same face to Earth because it is tidally locked. ' +
             'It stabilises Earth\u2019s axial tilt and drives the tides.'
    }),
    moon({
      id: 'io', name: 'Io', parent: 'jupiter', radiusKm: 1821.6,
      aKm: 421700, period: 1.769138, phase: 40.0, inc: 0.05, node: 20.0,
      color: '#f4d35e', glow: '#fff0a8', rotDays: 1.769138, tidallyLocked: true,
      facts: {
        'Diameter': '3,643 km',
        'Mass': '0.015 × Earth',
        'Orbital period': '1.769 days',
        'Distance from Jupiter': '421,700 km',
        'Rotation': 'Tidally locked to Jupiter',
        'Surface': '400+ active volcanoes',
        'Plume height': 'Up to 500 km',
        'Discovered': '1610, by Galileo Galilei'
      },
      blurb: 'The most volcanically active world known: Jupiter\u2019s tides ' +
             'squeeze it so hard that its surface is repaved continuously.'
    }),
    moon({
      id: 'europa', name: 'Europa', parent: 'jupiter', radiusKm: 1560.8,
      aKm: 671034, period: 3.551181, phase: 155.0, inc: 0.47, node: 60.0,
      color: '#e8d8b8', glow: '#fff6e2', rotDays: 3.551181, tidallyLocked: true,
      facts: {
        'Diameter': '3,122 km',
        'Mass': '0.008 × Earth',
        'Orbital period': '3.551 days',
        'Distance from Jupiter': '671,000 km',
        'Rotation': 'Tidally locked to Jupiter',
        'Surface': 'Water-ice shell over a salty ocean',
        'Ocean depth': '60-150 km of water',
        'Discovered': '1610, by Galileo Galilei'
      },
      blurb: 'Beneath a smooth ice crust lies a global ocean holding twice the ' +
             'water of all Earth\u2019s oceans — a prime target in the search ' +
             'for life.'
    }),
    moon({
      id: 'ganymede', name: 'Ganymede', parent: 'jupiter', radiusKm: 2634.1,
      aKm: 1070412, period: 7.154553, phase: 265.0, inc: 0.20, node: 100.0,
      color: '#b8ab98', glow: '#ded3c2', rotDays: 7.154553, tidallyLocked: true,
      facts: {
        'Diameter': '5,268 km',
        'Mass': '0.025 × Earth',
        'Orbital period': '7.155 days',
        'Distance from Jupiter': '1,070,000 km',
        'Rotation': 'Tidally locked to Jupiter',
        'Rank': 'Largest moon in the Solar System',
        'Feature': 'Only moon with its own magnetic field',
        'Discovered': '1610, by Galileo Galilei'
      },
      blurb: 'Bigger than the planet Mercury. Ganymede has a buried ocean and ' +
             'generates its own magnetic field.'
    }),
    moon({
      id: 'callisto', name: 'Callisto', parent: 'jupiter', radiusKm: 2410.3,
      aKm: 1882709, period: 16.689017, phase: 320.0, inc: 0.19, node: 140.0,
      color: '#8d8378', glow: '#bfb5a8', rotDays: 16.689017, tidallyLocked: true,
      facts: {
        'Diameter': '4,821 km',
        'Mass': '0.018 × Earth',
        'Orbital period': '16.689 days',
        'Distance from Jupiter': '1,883,000 km',
        'Rotation': 'Tidally locked to Jupiter',
        'Surface': 'Most heavily cratered in the Solar System',
        'Environment': 'Outside Jupiter\u2019s worst radiation belts',
        'Discovered': '1610, by Galileo Galilei'
      },
      blurb: 'An ancient, crater-saturated iceball — the least geologically ' +
             'evolved body of the four Galilean moons.'
    })
  ];

  var api = { SUN: SUN, PLANETS: PLANETS, MOONS: MOONS, KM_TO_AU: KM };

  global.SolarData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
