// "Describe this moment": one or two plain sentences about what is on screen right now,
// built only from the numbers read from the current NASA frame.

import { GX, GY } from './analyzer.js';
import { tempC, rowLat } from './tracks.js';
import { area } from './explore.js';

const LIGHT_MIN = 0.0005;
const LIGHT_FULL = 0.00097;

function maxIndex(arr, ok = () => true) {
  let best = -1, bv = -Infinity;
  arr.forEach((v, i) => { if (ok(i) && v > bv) { bv = v; best = i; } });
  return best;
}

function thirdWord(c) { return c < GX / 3 ? 'left' : c >= (2 * GX) / 3 ? 'right' : 'centre'; }

export function describeMoment(trackId, f) {
  if (!f) return 'Nothing to describe yet. Press Listen first.';
  const cells = f.cells;

  if (trackId === 'ocean') {
    const rows = f.rows;
    const ok = (r) => rows[r].sat > 0.02;
    const temps = rows.map((row) => row.temp);
    const warm = maxIndex(temps, ok);
    const coldN = maxIndex(temps.map((t) => -t), (r) => ok(r) && r < GY / 2);
    const coldS = maxIndex(temps.map((t) => -t), (r) => ok(r) && r >= GY / 2);
    const fast = maxIndex(Array.from(cells.motion), (i) => cells.sat[i] > 0.02);
    const C = (r) => Math.round(tempC(temps[r]));
    let text = `Warmest water: about ${C(warm)} °C, around ${rowLat(warm)}.`;
    if (coldN >= 0 && coldS >= 0) text += ` Coldest: about ${C(coldN)} °C around ${rowLat(coldN)} and about ${C(coldS)} °C around ${rowLat(coldS)}.`;
    if (fast >= 0 && cells.motion[fast] > 0.002) text += ` The currents are moving fastest in the ${area(Math.floor(fast / GX), fast % GX).toLowerCase()} of the map, around ${rowLat(Math.floor(fast / GX))}.`;
    return `${text} Temperatures are estimated from NASA’s colour scale.`;
  }

  if (trackId === 'nightlights') {
    let top = 0, all = 0;
    for (let r = 0; r < GY; r++) for (let c = 0; c < GX; c++) {
      const d = cells.density[r * GX + c];
      all += d;
      if (r < GY / 2) top += d;
    }
    const brightest = maxIndex(f.cols.map((c) => c.density));
    const level = Math.round(Math.max(0, Math.min(1, (f.density - LIGHT_MIN) / (LIGHT_FULL - LIGHT_MIN))) * 100);
    if (f.purple > 0.0004) {
      const ratio = f.orange > 0 ? f.purple / f.orange : 0;
      const newest = maxIndex(f.cols.map((c) => c.purple));
      const r = ratio >= 1.5 ? `about ${Math.round(ratio)} times as much of the map as` : ratio > 0.67 ? 'about as much of the map as' : 'less of the map than';
      return `This is NASA’s change map, 2012 to 2023. New lights (purple) cover ${r} lights that went out (orange). ` +
        `The most new light is in the ${thirdWord(newest)} of the map.`;
    }
    return `Night lights, one year at a time. Total light is at ${level}% of the scale. ` +
      `About ${Math.round((top / (all || 1)) * 100)}% of all light is in the top half of the map, ` +
      `and the brightest band is in the ${thirdWord(brightest)} of the map.`;
  }

  if (trackId === 'lightning') {
    const spots = [];
    for (let i = 0; i < GX * GY; i++) if (cells.density[i] > 0.002) spots.push(i);
    if (!spots.length) return 'No lightning in view right now.';
    const most = maxIndex(Array.from(cells.density));
    const where = area(Math.floor(most / GX), most % GX).toLowerCase();
    return `Lightning in ${spots.length} ${spots.length === 1 ? 'area' : 'areas'} of the view. ` +
      `The most is in the ${where} of the view.`;
  }

  if (trackId === 'co2') {
    const rows = f.rows.map((r) => r.density);
    const thick = maxIndex(rows);
    const col = maxIndex(f.cols.map((c) => c.density));
    let top = 0, all = 0;
    rows.forEach((d, r) => { all += d; if (r < GY / 2) top += d; });
    return `The thickest carbon dioxide is around ${rowLat(thick)}, in the ${thirdWord(col)} of the map. ` +
      `About ${Math.round((top / (all || 1)) * 100)}% of the visible plumes are in the Northern Hemisphere.`;
  }
  return '';
}
