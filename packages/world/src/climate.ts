// Time, seasons, daylight, weather and temperature. Pure functions of (seed, t).
import { WORLD_CONFIG, type WorldConfig } from "./config";
import { rand01 } from "./rng";
import { SEASONS, type Season, type TimeOfDay, type WeatherKind } from "./types";

export interface Clock {
  seed: number;
  genesisClock: number;
}

const DAY = 1440;
const smooth = (x: number): number => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export function clockMinute(w: Clock, t: number): number {
  return w.genesisClock + t;
}
export function minuteOfDay(w: Clock, t: number): number {
  return ((clockMinute(w, t) % DAY) + DAY) % DAY;
}
export function dayIndex(w: Clock, t: number): number {
  return Math.floor(clockMinute(w, t) / DAY);
}
/** Continuous position in the year, in days. */
export function yearDays(t: number, cfg: WorldConfig = WORLD_CONFIG): number {
  const year = cfg.seasonDays * 4;
  return (((cfg.genesisYearDays + t / DAY) % year) + year) % year;
}
export function seasonAt(t: number, cfg: WorldConfig = WORLD_CONFIG): Season {
  return SEASONS[Math.floor(yearDays(t, cfg) / cfg.seasonDays) % 4] as Season;
}
/** Sinusoid over the year: 0 at season-start of spring, +1 mid summer, -1 mid winter. */
function annual(t: number, cfg: WorldConfig): number {
  return Math.sin(2 * Math.PI * (yearDays(t, cfg) / (cfg.seasonDays * 4) - 0.125));
}

/** Gentle-start abundance multiplier: ramp.start fading linearly to 1.0 over ramp.days. */
export function abundanceRamp(t: number, cfg: WorldConfig = WORLD_CONFIG): number {
  const f = Math.min(1, Math.max(0, t / (cfg.ramp.days * DAY)));
  return cfg.ramp.start + (1 - cfg.ramp.start) * f;
}

export function dayLengthHours(t: number, cfg: WorldConfig = WORLD_CONFIG): number {
  return cfg.daylight.meanHours + cfg.daylight.ampHours * annual(t, cfg);
}

/** Sun-only light, 0..1 (no weather). */
export function sunLight(w: Clock, t: number, cfg: WorldConfig = WORLD_CONFIG): number {
  const m = minuteOfDay(w, t);
  const half = (dayLengthHours(t, cfg) * 60) / 2;
  const tw = cfg.daylight.twilightMinutes;
  const rise = 720 - half;
  const set = 720 + half;
  const up = smooth((m - (rise - tw / 2)) / tw);
  const down = 1 - smooth((m - (set - tw / 2)) / tw);
  return Math.min(up, down);
}

export function timeOfDay(w: Clock, t: number, cfg: WorldConfig = WORLD_CONFIG): TimeOfDay {
  const s = sunLight(w, t, cfg);
  if (s >= 0.999) return "day";
  if (s <= 0.001) return "night";
  return minuteOfDay(w, t) < 720 ? "dawn" : "dusk";
}

export interface Weather {
  kind: WeatherKind;
  precip: number; // 0..1 rain/snow intensity
  wind: number; // 0..1
  cloud: number; // 0..1
}

function baseOutsideTemp(w: Clock, t: number, cfg: WorldConfig): number {
  const c = cfg.temp;
  const hour = minuteOfDay(w, t) / 60;
  const daily = c.dailyAmp * Math.cos((2 * Math.PI * (hour - c.warmestHour)) / 24);
  const noise = (rand01(w.seed, 11, dayIndex(w, t)) - 0.5) * 2 * c.dayNoise;
  return c.mean + c.annualAmp * annual(t, cfg) + daily + noise;
}

/** Weather is constant within a block of `weather.blockHours` clock hours. */
export function weatherAt(w: Clock, t: number, cfg: WorldConfig = WORLD_CONFIG): Weather {
  const wc = cfg.weather;
  const block = Math.floor(clockMinute(w, t) / (wc.blockHours * 60));
  const season = seasonAt(t, cfg);
  const r = rand01(w.seed, 21, block);
  const hour = minuteOfDay(w, t) / 60;
  let kind: WeatherKind = "clear";
  let precip = 0;
  if (r < wc.rain[season]) {
    precip = 0.25 + 0.75 * rand01(w.seed, 22, block);
    kind = baseOutsideTemp(w, t, cfg) <= cfg.temp.snowBelow ? "snow" : "rain";
  } else if (r < wc.rain[season] + wc.fog[season]) {
    kind = hour < wc.fogUntilHour ? "fog" : "cloudy";
  } else if (r < wc.rain[season] + wc.fog[season] + wc.cloudy[season]) {
    kind = "cloudy";
  }
  const wind = Math.min(
    1,
    wc.wind[season] * (0.4 + 1.2 * rand01(w.seed, 23, block)) + precip * 0.3,
  );
  return { kind, precip, wind, cloud: wc.cloudCover[kind] };
}

/** Outside air temperature in deg C. */
export function ambientTempOutside(w: Clock, t: number, cfg: WorldConfig = WORLD_CONFIG): number {
  return baseOutsideTemp(w, t, cfg) + cfg.temp.weatherOffset[weatherAt(w, t, cfg).kind];
}

/** Outside light 0..1: sun + faint moon floor, dimmed by cloud, fog and precipitation. */
export function daylightAt(w: Clock, t: number, cfg: WorldConfig = WORLD_CONFIG): number {
  const wx = weatherAt(w, t, cfg);
  const sun = sunLight(w, t, cfg) * (1 - 0.4 * wx.cloud - (wx.kind === "fog" ? 0.15 : 0));
  return Math.min(1, Math.max(cfg.daylight.moon * (1 - 0.5 * wx.cloud), sun));
}
