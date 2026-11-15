# Earth Jukebox

Listen to NASA's view of a changing planet. Earth Jukebox plays NASA Earth Information Center visualizations and turns their pixels into calm, live-generated music.

Built for the **NASA Space Apps Challenge 2026**, challenge: *The Earth Information Jukebox*.

## How it works

1. The page plays a NASA visualization video.
2. About 12 times a second, the current frame is shrunk to 64 x 32 pixels and split into a 16 x 16 grid.
3. Each cell is measured: brightness, colour (hue read as temperature, purple and orange read as light change), movement and bright points.
4. Each track maps those numbers to sound with Tone.js. Every note snaps to a D major pentatonic scale, with slow attacks and long reverb, so the result stays calm.
5. The "What you are hearing" panel shows live meters and explains each mapping in plain words.

| Track | NASA source | Mapping |
| --- | --- | --- |
| Ocean Currents | [SVS 3912](https://svs.gsfc.nasa.gov/3912) | A scan line moves pole to pole. Water temperature on the line sets the chord; current movement sets brightness and bell count. |
| Night Lights 2012 to 2023 | [SVS 5313](https://svs.gsfc.nasa.gov/5313) | A playhead sweeps west to east. Lit areas ring bells (north is higher). In the change map, purple (more light) rings high and orange (less light) rings low. |
| Lightning from Space | [SVS 5011](https://svs.gsfc.nasa.gov/5011) | More lightning means more chimes. Pitch follows latitude, so the storm seasons are heard drifting north and south. |

## Accessibility

Full keyboard control (Space, arrow keys), screen-reader labels, a live region announcing the track, a text description of every visualization and visible focus. Works without seeing the screen.

## Run locally

Open the folder in VS Code and use the Live Server extension ("Go Live"). Opening `index.html` directly from disk will not work, because browsers block pixel reading on `file://`.

## Credits

- Visualizations: NASA's Scientific Visualization Studio (Earth Information Center collection). NASA does not endorse this project.
- Data: ECCO2 ocean model (NASA/JPL); NASA Black Marble, Suomi NPP VIIRS; Lightning Imaging Sensor on the ISS (NASA GHRC DAAC).
- Sound engine: [Tone.js](https://tonejs.github.io/) 15.1.22, MIT License.

## AI use

Code written with AI assistance (Claude Opus 5.5), directed and tuned by the team. All audio is generated live by an algorithm from NASA visualization frames. No audio, images or video in this project were made by generative AI.
