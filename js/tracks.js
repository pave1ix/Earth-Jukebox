// Track settings. Change numbers here to tune the sound without touching logic.
// view    = the part of the NASA video that is shown and read (fractions of the frame)
// ignore  = areas inside the view that are never read (labels, colour bars)
// segment = the part of the clip that plays, in seconds
// res     = size of the grid of samples read from each frame
// "tune" values are live-editable in the Tuning panel (open the page with ?tune).

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
      { key: 'temp', label: 'Temperature on the scan line' },
      { key: 'motion', label: 'Current movement' },
      { key: 'latitude', label: 'Scan line, south to north' },
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
    res: [320, 180],
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
      { key: 'total', label: 'Total light on Earth' },
      { key: 'more', label: 'New lights (purple)' },
      { key: 'less', label: 'Lights out (orange)' },
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
      { key: 'density', label: 'Lightning in view' },
      { key: 'latitude', label: 'Where it is, south to north' },
      { key: 'side', label: 'Where it is, left to right' },
    ],
    tuneKeys: ['bell', 'pad', 'drone', 'rate', 'reverb', 'smooth'],
    tune: { bell: 0, pad: 0, drone: 0, rate: 1, reverb: 0.5, smooth: 0.3 },
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
