/**
 * The restaurant's business day. "Today" must follow the restaurant's clock (India, UTC+05:30 by
 * default), not the server's UTC date — otherwise every report and dashboard shows yesterday's
 * numbers between midnight and 05:30. Override with BUSINESS_UTC_OFFSET (e.g. "+04:00").
 */
function offsetMinutes() {
  const raw = String(process.env.BUSINESS_UTC_OFFSET || '+05:30').trim();
  const m = raw.match(/^([+-])(\d{1,2}):?(\d{2})$/);
  if (!m) return 330;
  const mins = Number(m[2]) * 60 + Number(m[3]);
  return m[1] === '-' ? -mins : mins;
}

/** Calendar date (YYYY-MM-DD) of an instant in business time. */
function businessDate(date = new Date()) {
  const shifted = new Date(date.getTime() + offsetMinutes() * 60000);
  return shifted.toISOString().slice(0, 10);
}

/** [start, end) instants of the business day containing `date`, or of a YYYY-MM-DD string. */
function businessDayRange(date = new Date()) {
  const ymd = typeof date === 'string' ? date : businessDate(date);
  const [y, mo, d] = ymd.split('-').map(Number);
  const start = new Date(Date.UTC(y, mo - 1, d) - offsetMinutes() * 60000);
  return { start, end: new Date(start.getTime() + 86400000), date: ymd };
}

/** [start, end) instants covering business dates from..to inclusive (YYYY-MM-DD). */
function businessRange(fromYmd, toYmd) {
  const start = businessDayRange(fromYmd).start;
  const end = businessDayRange(toYmd).end;
  return { start, end };
}

module.exports = { offsetMinutes, businessDate, businessDayRange, businessRange };
