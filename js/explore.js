// Explore mode: describe and sonify one cell of the 16 x 16 grid under the cursor.
// Every description is read from the pixels; temperatures are estimated from the colour scale.

import { GX, GY } from './analyzer.js';
import { tempC } from './tracks.js';

const D3 = 5;
const D4 = 10;

export function area(r, c) {
  const v = r < 5 ? 'Top' : r < 11 ? 'Middle' : 'Bottom';
  const h = c < 5 ? 'left' : c < 11 ? 'centre' : 'right';
  return v === 'Middle' && h === 'centre' ? 'Centre' : `${v} ${h}`;
}

function maxOf(arr) {
  let m = 0;
  for (const v of arr) if (v > m) m = v;
  return m || 1;
}

export function describeCell(trackId, f, r, c) {
  const i = r * GX + c;
  const cells = f.cells;
  const where = `${area(r, c)}, row ${r + 1} of ${GY}, column ${c + 1} of ${GX}.`;

  if (trackId === 'ocean') {
    const sat = cells.sat[i];
    const t = cells.temp[i];
    if (sat < 0.01 || t < 0) {
      return { text: `${where} No ocean colour here, likely land or ice.`, sound: { kind: 'soft', idx: 2, vel: 0.15 } };
    }
    const deg = Math.round(tempC(t));
    const word = deg < 8 ? 'Cold' : deg < 18 ? 'Cool' : deg < 27 ? 'Warm' : 'Hot';
    return {
      text: `${where} ${word} water, about ${deg} °C, estimated from the colour scale.`,
      sound: { kind: 'bell', idx: D3 + Math.round(t * 12), vel: 0.35 + 0.4 * Math.min(1, sat * 4) },
    };
  }

  if (trackId === 'nightlights') {
    const light = cells.density[i];
    const bn = light / maxOf(cells.density);
    const changeMode = f.purple > 0.0004;
    if (changeMode) {
      const p = cells.purple[i];
      const o = cells.orange[i];
      if (o > 0.001 && o > p * 0.6) {
        return { text: `${where} Lights went out here between 2012 and 2023.`, sound: { kind: 'soft', idx: D3, vel: 0.5 } };
      }
      if (p > 0.001) {
        return { text: `${where} New lights here since 2012.`, sound: { kind: 'bell', idx: D4 + 7, vel: 0.35 + 0.5 * Math.min(1, p * 60) } };
      }
    }
    if (light < 0.00005 || bn < 0.04) return { text: `${where} Dark. Few or no lights.`, sound: { kind: 'none' } };
    const word = bn < 0.3 ? 'Some lights.' : bn < 0.65 ? 'Bright lights.' : 'Among the brightest places on Earth at night.';
    return { text: `${where} ${word}`, sound: { kind: 'bell', idx: D3 + Math.round(bn * 12), vel: 0.25 + 0.55 * bn } };
  }

  if (trackId === 'co2') {
    const d = cells.density[i];
    if (d < 0.01) return { text: `${where} Little or no thick carbon dioxide here.`, sound: { kind: 'none' } };
    const dn = d / maxOf(cells.density);
    const word = dn < 0.35 ? 'Some thick carbon dioxide.' : dn < 0.7 ? 'Thick carbon dioxide.' : 'Among the thickest carbon dioxide on the map.';
    return { text: `${where} ${word}`, sound: { kind: 'soft', idx: D3 + 1 + Math.round((1 - r / (GY - 1)) * 9), vel: 0.35 + 0.45 * dn } };
  }

  // lightning
  const d = cells.density[i];
  if (d < 0.002) return { text: `${where} No lightning here right now.`, sound: { kind: 'none' } };
  const dn = d / maxOf(cells.density);
  const word = dn < 0.35 ? 'A little lightning.' : dn < 0.7 ? 'Lightning.' : 'The most lightning in view.';
  return {
    text: `${where} ${word}`,
    sound: { kind: 'bell', idx: D4 + Math.round((1 - r / (GY - 1)) * 9), vel: 0.3 + 0.4 * dn, count: 1 + Math.round(dn * 2) },
  };
}
