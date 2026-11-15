// Track settings. Change numbers here to tune the sound without touching logic.
// "tune" values are live-editable in the Tuning panel; "Copy settings" exports them.

export const TRACKS = [
  {
    id: 'ocean',
    title: 'Ocean Currents',
    line: 'Pole to pole: hear the water warm toward the equator.',
    file: 'Media/ocean.mp4',
    crop: { x: 0, y: 0, w: 1, h: 1 },
    description:
      'Sea surface currents from the ECCO2 ocean model, coloured by sea surface temperature: ' +
      'blue is near 0 °C, green 10 to 20 °C, yellow about 25 °C and red up to 32 °C.',
    credit: "NASA Goddard Space Flight Center Scientific Visualization Studio. Data: ECCO2 ocean model (NASA/JPL).",
    source: 'https://svs.gsfc.nasa.gov/3912',
    legend: [
      'A scan line moves from the North Pole to the South Pole and back.',
      'The chord follows the water temperature on that line: warmer colours lift the chord higher.',
      'Faster-moving currents open up the sound and add more bell notes. Left or right follows where the current is on the map.',
    ],
    meters: [
      { key: 'temp', label: 'Water temperature on the scan line' },
      { key: 'motion', label: 'Current movement' },
      { key: 'latitude', label: 'Scan line position (full is north)' },
    ],
    tuneKeys: ['pad', 'bell', 'rate', 'step', 'chordHold', 'reverb', 'smooth'],
    tune: { pad: 0, bell: 0, rate: 1, step: 0.5, chordHold: 2, reverb: 0.45, smooth: 0.35 },
  },
  {
    id: 'nightlights',
    title: 'Night Lights 2012 to 2023',
    line: 'West to east: hear where the lights grew and faded.',
    file: 'Media/nightlights.mp4',
    crop: { x: 0, y: 0, w: 1, h: 1 },
    description:
      'Yearly averages of NASA Black Marble night lights from 2012 to 2023, then a map of change: ' +
      'purple where light increased, orange where it decreased, white for no change.',
    credit: "NASA's Scientific Visualization Studio. Data: NASA Black Marble, Suomi NPP VIIRS.",
    source: 'https://svs.gsfc.nasa.gov/5313',
    legend: [
      'A playhead sweeps the map from west to east.',
      'Each lit area rings a bell: brighter is louder, further north is higher.',
      'In the change map, purple (more light) rings a bright high bell and orange (less light) a low, soft tone.',
    ],
    meters: [
      { key: 'brightness', label: 'Total light on screen' },
      { key: 'more', label: 'More light (purple)' },
      { key: 'less', label: 'Less light (orange)' },
    ],
    tuneKeys: ['bell', 'soft', 'drone', 'step', 'gate', 'reverb', 'smooth'],
    tune: { bell: 0, soft: 0, drone: 0, step: 0.3, gate: 0.3, reverb: 0.5, smooth: 0.5 },
  },
  {
    id: 'lightning',
    title: 'Lightning from Space',
    line: 'Storms as sparkles, drifting with the seasons.',
    file: 'Media/lightning.mp4',
    crop: { x: 0, y: 0, w: 1, h: 1 },
    description:
      'Lightning detected by the Lightning Imaging Sensor on the International Space Station from 2017 to 2023, ' +
      'shown through a 10-day moving window so the storm seasons drift north and south.',
    credit: "NASA's Scientific Visualization Studio. Data: Lightning Imaging Sensor on the ISS (NASA GHRC DAAC).",
    source: 'https://svs.gsfc.nasa.gov/5011',
    legend: [
      'A low drone is the planet at rest.',
      'The more lightning on screen, the more chimes you hear.',
      'Chime pitch follows latitude, so you hear storms drift north and south with the seasons. Left or right follows longitude.',
    ],
    meters: [
      { key: 'density', label: 'Lightning on screen' },
      { key: 'latitude', label: 'Where the storms are (full is north)' },
      { key: 'brightness', label: 'Overall brightness' },
    ],
    tuneKeys: ['bell', 'pad', 'drone', 'rate', 'thresh', 'reverb', 'smooth'],
    tune: { bell: 0, pad: 0, drone: 0, rate: 1, thresh: 0.5, reverb: 0.5, smooth: 0.3 },
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
  gate: { label: 'Light needed to ring a bell', min: 0, max: 0.9, step: 0.05 },
  thresh: { label: 'Brightness that counts as lightning', min: 0.2, max: 0.95, step: 0.05 },
  reverb: { label: 'Reverb', min: 0, max: 0.9, step: 0.05 },
  smooth: { label: 'Responsiveness (low is smoother)', min: 0.05, max: 1, step: 0.05 },
};
