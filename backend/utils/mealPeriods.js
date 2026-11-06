/**
 * Breakfast / lunch / dinner menus (REQ-001).
 *
 * A restaurant can switch on meal scheduling and set a time window per period. A dish (or its
 * category) can be tagged with the periods it is served in; untagged dishes are served all day.
 * Customers only see — and can only order — dishes served in the selected / current period.
 * Times follow the restaurant's business clock (utils/businessTime).
 */
const { offsetMinutes } = require('./businessTime');

const PERIODS = ['BREAKFAST', 'LUNCH', 'DINNER'];
const LABELS = { BREAKFAST: 'Breakfast', LUNCH: 'Lunch', DINNER: 'Dinner' };
const DEFAULT_WINDOWS = {
  BREAKFAST: { start: '07:00', end: '11:00' },
  LUNCH: { start: '12:00', end: '16:00' },
  DINNER: { start: '19:00', end: '23:00' }
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm) {
  const m = String(hhmm || '').match(TIME_RE);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function formatTime(hhmm) {
  const mins = toMinutes(hhmm);
  if (mins === null) return hhmm;
  const h = Math.floor(mins / 60), m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${suffix}` : `${h12} ${suffix}`;
}

/** Normalise a list of periods from an array or "BREAKFAST,LUNCH" text; [] means all day. */
function normalizePeriods(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return [];
  const list = Array.isArray(value) ? value : String(value).split(',');
  const out = [...new Set(list.map((p) => String(p).trim().toUpperCase()).filter((p) => PERIODS.includes(p)))];
  return PERIODS.filter((p) => out.includes(p)); // stable order
}

function periodsToColumn(list) {
  return list && list.length ? list.join(',') : null;
}

/** Validate/clean a windows object from the settings form. Throws Error with a readable message. */
function cleanWindows(input) {
  let obj = input;
  if (typeof obj === 'string') {
    try { obj = JSON.parse(obj); } catch (e) { throw new Error('Meal times are not valid.'); }
  }
  const out = {};
  for (const p of PERIODS) {
    const w = (obj && obj[p]) || DEFAULT_WINDOWS[p];
    if (toMinutes(w.start) === null || toMinutes(w.end) === null) {
      throw new Error(`${LABELS[p]} times must look like 07:30.`);
    }
    if (w.start === w.end) throw new Error(`${LABELS[p]} start and end time cannot be the same.`);
    out[p] = { start: w.start, end: w.end };
  }
  return out;
}

function configFor(restaurant) {
  let windows = DEFAULT_WINDOWS;
  if (restaurant && restaurant.meal_periods_json) {
    try { windows = cleanWindows(restaurant.meal_periods_json); } catch (e) { windows = DEFAULT_WINDOWS; }
  }
  return { enabled: Boolean(restaurant && Number(restaurant.meal_schedule_enabled) === 1), windows };
}

/** Minutes since midnight on the restaurant's clock. */
function businessMinutes(now = new Date()) {
  const shifted = new Date(now.getTime() + offsetMinutes() * 60000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function inWindow(window, minutes) {
  const s = toMinutes(window.start), e = toMinutes(window.end);
  return s < e ? (minutes >= s && minutes < e) : (minutes >= s || minutes < e); // window may cross midnight
}

/** The period being served right now, or null between services. */
function currentPeriod(config, now = new Date()) {
  if (!config.enabled) return null;
  const mins = businessMinutes(now);
  return PERIODS.find((p) => inWindow(config.windows[p], mins)) || null;
}

/** Periods a dish is served in: its own tags, else its category's, else all day ([]). */
function effectivePeriods(itemPeriods, categoryPeriods) {
  const own = normalizePeriods(itemPeriods || '');
  if (own.length) return own;
  return normalizePeriods(categoryPeriods || '');
}

function servedIn(periods, period) {
  return periods.length === 0 || (period && periods.includes(period));
}

function describe(config) {
  return PERIODS.map((p) => ({
    key: p,
    label: LABELS[p],
    start: config.windows[p].start,
    end: config.windows[p].end,
    display: `${formatTime(config.windows[p].start)} – ${formatTime(config.windows[p].end)}`
  }));
}

function servedWhenText(periods, config) {
  return periods.map((p) => `${LABELS[p]} (${formatTime(config.windows[p].start)}–${formatTime(config.windows[p].end)})`).join(', ');
}

module.exports = {
  PERIODS,
  LABELS,
  DEFAULT_WINDOWS,
  normalizePeriods,
  periodsToColumn,
  cleanWindows,
  configFor,
  currentPeriod,
  effectivePeriods,
  servedIn,
  describe,
  servedWhenText
};
