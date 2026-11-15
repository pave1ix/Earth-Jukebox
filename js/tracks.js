// Track settings. Change numbers here to tune the sound without touching logic.
// view    = the part of the NASA video that is shown and read (fractions of the frame)
// ignore  = areas inside the view that are never read (labels, colour bars)
// segment = the part of the clip that plays, in seconds
// res     = size of the grid of samples read from each frame
// "tune" values are live-editable in the Tuning panel (open the page with ?tune).

// Ocean colour bar (NASA SVS 3912): blue 0 °C, green 10 to 20 °C, yellow about 25 °C, red 32 °C.
// t = position along the colour scale, 0 (blue) to 1 (red). Returns an estimate in °C.
export function tempC(t) {
  const pts = [[0, 0], [0.5, 15], [0.75, 25], [1, 32]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (t <= x1) return y0 + ((t - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 32;
}

// Latitude at the centre of grid row r (0..15) on a full-globe flat map.
export function rowLat(r) {
  const lat = 90 - (r + 0.5) * (180 / 16);
  return `${Math.abs(Math.round(lat))}° ${lat >= 0 ? 'N' : 'S'}`;
}

const pct = (v) => `${Math.round(v * 100)}%`;
const third = (v) => (v < 0.36 ? 'left' : v > 0.64 ? 'right' : 'centre');
const half = (v) => (v > 0.56 ? 'upper part' : v < 0.44 ? 'lower part' : 'middle');

export const TRACKS = [
  {
    id: 'ocean',
    code: 'A1',
    title: 'Ocean currents',
    line: 'Warm at the equator, cold at the poles',
    file: 'Media/ocean.mp4',
    poster: 'Media/ocean.jpg',
    view: { x: 0, y: 0, w: 1, h: 1 },
    aspect: 2,
    ignore: [{ x: 0, y: 0.89, w: 0.18, h: 0.11 }], // NASA colour bar
    segment: null,
    rate: 1,
    res: [64, 32],
    detect: 'ocean',
    accent: '#ff8a3d',
    dot: { gain: 1.5, gamma: 0.8, colour: 0.85 },
    focusY: 0.5,
    description:
      'Sea surface currents from the ECCO2 ocean model, coloured by sea surface temperature. ' +
      'Blue is near 0 °C, green 10 to 20 °C, yellow about 25 °C, red up to 32 °C. Land is grey.',
    credit: 'NASA Goddard Space Flight Center Scientific Visualization Studio. Data: ECCO2 ocean model, NASA/JPL.',
    source: 'https://svs.gsfc.nasa.gov/3912',
    key: [
      { swatch: 'linear-gradient(90deg,#1c3cff,#14c8a0,#ffe24a,#ff3a1c)', what: 'Water temperature, 0 to 32 °C', hear: 'Chord, low to high' },
      { swatch: null, what: 'Speed of the currents', hear: 'Brighter tone, more bells' },
      { swatch: 'line', what: 'Scan line, pole to pole', hear: 'Where the chord is read' },
    ],
    meters: [
      { key: 'temp', label: 'Temperature on the scan line', fmt: (v) => `about ${Math.round(tempC(v))} °C` },
      { key: 'motion', label: 'Current movement', fmt: pct },
      { key: 'latitude', label: 'Scan line position', fmt: (v) => rowLat(Math.round((1 - v) * 15)) },
    ],
    method: [
      'Each square of a 16 by 16 grid is read about 12 times a second. Only coloured current lines count; grey land and black sea are skipped.',
      'The colour of the lines is turned back into temperature using NASA’s colour bar: blue 0 °C, green 10 to 20 °C, yellow about 25 °C, red 32 °C. These are estimates read from the picture, not the model’s raw numbers.',
      'Movement is the change between one reading and the next, so faster-flowing currents score higher.',
    ],
    keySteps: [
      { text: 'Cold water, near 0 °C, sounds like this low chord.', sound: { kind: 'arp', idx: 5, vel: 0.6 } },
      { text: 'Warm water, near 30 °C, sounds like this high chord.', sound: { kind: 'arp', idx: 11, vel: 0.6 } },
      { text: 'Fast-moving currents add quick bells like these.', sound: { kind: 'bell', idx: 15, vel: 0.5, count: 3 } },
    ],
    tuneKeys: ['pad', 'bell', 'rate', 'step', 'chordHold', 'reverb', 'smooth'],
    tune: { pad: 0, bell: 0, rate: 1, step: 0.5, chordHold: 2, reverb: 0.45, smooth: 0.35 },
  },
  {
    id: 'nightlights',
    code: 'A2',
    title: 'Night lights',
    line: 'Eleven years of light, 2012 to 2023',
    file: 'Media/nightlights.mp4',
    poster: 'Media/nightlights.jpg',
    view: { x: 0.47, y: 0, w: 0.5, h: 1 }, // NASA's wide version repeats the map; this is one full world
    aspect: 16 / 9,
    ignore: [{ x: 0.02, y: 0.46, w: 0.2, h: 0.16 }], // year label and colour bar
    segment: [0, 19.3], // after this NASA adds zoom boxes over the map
    rate: 0.5,
    res: [480, 270],
    detect: 'lights',
    accent: '#ffc56e',
    dot: { gain: 5.5, gamma: 0.8 },
    focusY: 0.36,
    description:
      'Yearly averages of night lights from 2012 to 2023, from NASA’s Black Marble data. ' +
      'Then a map of what changed: purple where new lights appeared, orange where lights went out.',
    credit: 'NASA’s Scientific Visualization Studio. Data: NASA Black Marble, Suomi NPP VIIRS.',
    source: 'https://svs.gsfc.nasa.gov/5313',
    key: [
      { swatch: '#ffd58a', what: 'City lights', hear: 'Bell. Brighter is louder, north is higher' },
      { swatch: '#a779e6', what: 'New lights since 2012', hear: 'Bright, high bell' },
      { swatch: '#f0a04b', what: 'Lights that went out', hear: 'Low, soft tone' },
      { swatch: 'line', what: 'Playhead, west to east', hear: 'Which part of the world is ringing' },
    ],
    meters: [
      { key: 'total', label: 'Total light on Earth', fmt: pct },
      { key: 'more', label: 'New lights (purple)', fmt: pct },
      { key: 'less', label: 'Lights out (orange)', fmt: pct },
    ],
    method: [
      'NASA’s wide version shows the world twice; one full world is read. The clip stops before NASA’s zoom boxes appear.',
      'Light is anything brighter than the dark grey land. The year label and the colour bar are masked so they never make sound.',
      'Total light is measured on a fixed scale, so the rise from 2012 to 2023 is heard as the drone getting louder. In the change map, purple pixels count as new lights and orange as lights that went out, on the same scale so they can be compared.',
    ],
    keySteps: [
      { text: 'City lights in the north of the map ring high bells.', sound: { kind: 'bell', idx: 18, vel: 0.6 } },
      { text: 'City lights further south ring lower bells.', sound: { kind: 'bell', idx: 11, vel: 0.6 } },
      { text: 'In the change map, new lights ring this bright, high bell.', sound: { kind: 'bell', idx: 20, vel: 0.7 } },
      { text: 'And lights that went out sound this low, soft tone.', sound: { kind: 'soft', idx: 5, vel: 0.7 } },
    ],
    tuneKeys: ['bell', 'soft', 'drone', 'step', 'gate', 'reverb', 'smooth'],
    tune: { bell: 0, soft: 0, drone: 0, step: 0.3, gate: 0.12, reverb: 0.5, smooth: 0.5 },
  },
  {
    id: 'lightning',
    code: 'A3',
    title: 'Lightning from orbit',
    line: 'Storms seen by the Space Station',
    file: 'Media/lightning.mp4',
    poster: 'Media/lightning.jpg',
    view: { x: 0.12, y: 0, w: 0.66, h: 1 },
    aspect: 2.347,
    ignore: [],
    segment: [20, 59.5], // the first 20 seconds contain no lightning
    rate: 1,
    res: [256, 108],
    detect: 'yellow',
    accent: '#ffe14d',
    dot: { gain: 2.6, gamma: 0.8 },
    description:
      'Lightning detected by the Lightning Imaging Sensor on the International Space Station, ' +
      'starting 1 March 2017. Each yellow point is lightning seen from orbit as the station passes over.',
    credit: 'NASA’s Scientific Visualization Studio. Data: Lightning Imaging Sensor on the ISS, NASA GHRC DAAC.',
    source: 'https://svs.gsfc.nasa.gov/5011',
    key: [
      { swatch: '#ffe14d', what: 'Detected lightning', hear: 'Chimes. More lightning, more chimes' },
      { swatch: null, what: 'Height on the globe', hear: 'Pitch: further north is higher' },
      { swatch: null, what: 'The planet at rest', hear: 'Low drone' },
    ],
    meters: [
      { key: 'density', label: 'Lightning in view', fmt: pct },
      { key: 'latitude', label: 'Where it is, top to bottom', fmt: half },
      { key: 'side', label: 'Where it is, left to right', fmt: third },
    ],
    method: [
      'Lightning is detected by its yellow colour. Stars, labels and the white Space Station track are not yellow, so they are skipped.',
      'The clip starts at the moment lightning first appears. When no lightning is in view, there are no chimes at all.',
      'The amount of lightning is measured on a fixed scale, so more lightning always means more chimes. Pitch follows height on the globe: higher on screen is higher in pitch.',
    ],
    keySteps: [
      { text: 'Lightning high on the globe sounds like this.', sound: { kind: 'bell', idx: 19, vel: 0.6, count: 2 } },
      { text: 'Lightning low on the globe sounds like this.', sound: { kind: 'bell', idx: 10, vel: 0.6, count: 2 } },
      { text: 'A busy storm area plays many chimes in a row.', sound: { kind: 'bell', idx: 15, vel: 0.5, count: 4 } },
    ],
    tuneKeys: ['bell', 'pad', 'drone', 'rate', 'reverb', 'smooth'],
    tune: { bell: 0, pad: 0, drone: 0, rate: 1, reverb: 0.5, smooth: 0.3 },
  },
  {
    id: 'co2',
    code: 'A4',
    title: 'Carbon dioxide',
    line: 'The planet breathing, January to March 2020',
    file: 'Media/co2.mp4',
    poster: 'Media/co2.jpg',
    view: { x: 0, y: 0, w: 1, h: 1 },
    aspect: 2,
    ignore: [],
    segment: null,
    rate: 1,
    res: [256, 128],
    detect: 'orange',
    accent: '#ff7a3a',
    dot: { gain: 2.1, gamma: 0.8, colour: 0.55 },
    focusY: 0.42,
    description:
      'Carbon dioxide moving through the atmosphere from January to March 2020, from NASA’s GEOS model. ' +
      'Orange marks the highest concentrations, rising from fires, cities and power plants, and pulsing with day and night as plants take in and release the gas.',
    credit: 'NASA’s Scientific Visualization Studio. Data: DYAMOND run of the GEOS model, NASA Goddard Space Flight Center.',
    source: 'https://svs.gsfc.nasa.gov/5436',
    key: [
      { swatch: '#ff7a3a', what: 'Thick carbon dioxide', hear: 'Low, soft tone. Thicker is louder' },
      { swatch: null, what: 'Height on the map', hear: 'Pitch: further north is higher' },
      { swatch: null, what: 'All the orange on screen', hear: 'Background swells and fades, the planet breathing' },
      { swatch: 'line', what: 'Playhead, west to east', hear: 'Which part of the world is sounding' },
    ],
    meters: [
      { key: 'amount', label: 'Thick CO₂ on screen', fmt: pct },
      { key: 'latitude', label: 'Where it is thickest', fmt: (v) => rowLat(Math.round((1 - v) * 15)) },
      { key: 'side', label: 'Where it is, west to east', fmt: third },
    ],
    method: [
      'This is the flat-map version of NASA’s DYAMOND carbon dioxide visualization, one full world.',
      'Only the saturated orange that marks thick carbon dioxide counts. Snow, deserts and the pale haze are skipped.',
      'The amount on screen is measured on a fixed scale. The swelling and fading you hear follows the pulse NASA describes: fires and plants release and absorb carbon dioxide with day and night.',
    ],
    keySteps: [
      { text: 'Thick carbon dioxide in the south sounds like this low tone.', sound: { kind: 'soft', idx: 6, vel: 0.7 } },
      { text: 'Further north, the tone is higher.', sound: { kind: 'soft', idx: 13, vel: 0.7 } },
      { text: 'When much of the map turns orange, the background swells, like the planet breathing.', sound: { kind: 'arp', idx: 5, vel: 0.5 } },
    ],
    tuneKeys: ['pad', 'soft', 'step', 'gate', 'reverb', 'smooth'],
    tune: { pad: 0, soft: 0, step: 0.35, gate: 0.15, reverb: 0.5, smooth: 0.4 },
  },
];

// Slider ranges for the Tuning panel.
export const TUNE_SPEC = {
  pad: { label: 'Pad level (dB)', min: -24, max: 12, step: 1 },
  bell: { label: 'Bell level (dB)', min: -24, max: 12, step: 1 },
  soft: { label: 'Low tone level (dB)', min: -24, max: 12, step: 1 },
  drone: { label: 'Drone level (dB)', min: -24, max: 12, step: 1 },
  rate: { label: 'Note rate', min: 0.25, max: 2, step: 0.05 },
  step: { label: 'Scan speed (seconds per step)', min: 0.15, max: 1.2, step: 0.05 },
  chordHold: { label: 'Seconds between chord changes', min: 0.5, max: 8, step: 0.5 },
  gate: { label: 'Light needed to ring a bell', min: 0, max: 0.9, step: 0.02 },
  reverb: { label: 'Reverb', min: 0, max: 0.9, step: 0.05 },
  smooth: { label: 'Responsiveness (low is smoother)', min: 0.05, max: 1, step: 0.05 },
};
