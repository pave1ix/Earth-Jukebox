# Earth Jukebox

Hear the planet change. Earth Jukebox plays NASA Earth Information Center visualizations and turns them into calm, live-generated sound.

Built for the **NASA Space Apps Challenge 2026**, challenge: *The Earth Information Jukebox*.

## The idea

**Hear the planet change.** NASA's Earth Information Center shows a changing planet, but only to people who can see it. Earth Jukebox turns those visualizations into sound, so the change can be heard, and into a map you can explore by touch.

## How it works

1. The page plays a NASA visualization video.
2. About 12 times a second, the visible part of the frame is read and split into a 16 x 16 grid.
3. Each cell is measured. What is measured depends on the data: water temperature from the colour scale, city light above the dark land, purple and orange for change, yellow points for lightning.
4. Each track maps those numbers to sound with Tone.js. Every note snaps to a D major pentatonic scale, with slow attacks and long reverb, so the result stays calm.
5. The page explains every mapping in a listening key and shows live readings.

| Track | NASA source | What you hear |
| --- | --- | --- |
| Ocean currents | [SVS 3912](https://svs.gsfc.nasa.gov/3912) | A scan line moves pole to pole. Water temperature on the line sets the chord, low for cold and high for warm. Faster currents add bells. |
| Night lights | [SVS 5313](https://svs.gsfc.nasa.gov/5313) | A playhead sweeps west to east. Lit regions ring bells, north is higher, and the drone swells as total light grows from 2012 to 2023. In the change map, new lights ring a bright high bell and lights that went out sound a low tone. |
| Carbon dioxide | [SVS 5436](https://svs.gsfc.nasa.gov/5436), flat map of [SVS 5196](https://svs.gsfc.nasa.gov/5196) | The background swells and fades with the thick CO2 on screen, so the day-night pulse NASA describes is heard as breathing. A playhead sweeps west to east and thick plumes sound a low tone, pitched by latitude. |
| Lightning from orbit | [SVS 5011](https://svs.gsfc.nasa.gov/5011) | Only detected lightning makes chimes: more lightning, more chimes. No lightning, no chimes. Pitch follows height on the globe. |

### Honest reading of the frames

- Labels and colour bars inside the NASA frames are masked so they never make sound.
- NASA's wide night lights version repeats the world map; one full world is shown and read. Only the part before NASA's zoom boxes appear is used.
- Lightning is detected by its yellow colour, so stars, labels and the white ISS track are not mistaken for it. The clip starts where lightning first appears.
- Temperatures in explore mode are estimates read from the colour scale, and the page says so.

## The dot Earth

The drawing at the top of the page is not decoration. It is the NASA frame that is playing, redrawn live as fine dots: bright data makes dense dots and each dot keeps the colour of the data. When a note plays, a ring of dots spreads from the place on the map the note came from.

## Explore by touch

Press **Explore by touch** (or E). The music pauses and the map becomes touchable: move the mouse, a finger or the arrow keys across the grid and hear what is under you. Each place plays its own note and is described in words for screen readers, for example "Warm water, about 25 °C, estimated from the colour scale" or "New lights here since 2012". Freeze frame holds one moment to study it.

## Describe, key and read aloud

- **Describe this moment** (D) says in one or two sentences what is on screen right now, built only from the numbers read off the frame, for example "Warmest water: about 29 °C, around 6° S" or "New lights cover about 10 times as much of the map as lights that went out".
- **Hear the key** (K) plays each sound of the current track with a sentence explaining what it means, so a listener learns the mapping before listening.
- **Read aloud** (R) speaks every description with the browser's own voice, for people who do not use a screen reader.
- Every live reading shows its value in words or units (°C, latitude, left or right), and each track lists how it reads the data and what its limits are.

## Accessibility

Full keyboard control (Space, E, arrow keys, Escape), screen-reader labels, a live region announcing each track with its description, a text description of every visualization and visible focus. Motion is reduced for people who ask their system for that.

## Run locally

Open the folder in VS Code and use the Live Server extension ("Go Live"). Opening `index.html` directly from disk will not work, because browsers block pixel reading on `file://`.

## Credits

- Visualizations: NASA's Scientific Visualization Studio (Earth Information Center collection). NASA does not endorse this project.
- Data: ECCO2 ocean model (NASA/JPL); NASA Black Marble, Suomi NPP VIIRS; Lightning Imaging Sensor on the ISS (NASA GHRC DAAC); DYAMOND run of the GEOS model (NASA Goddard).
- Sound engine: [Tone.js](https://tonejs.github.io/) 15.1.22, MIT License.

## AI use

Code written with AI assistance (Claude Opus 5.5 and Claude Fable 5.2), directed and tuned by the team. All audio is generated live by an algorithm from NASA visualization frames. No audio, images or video in this project were made by generative AI.
