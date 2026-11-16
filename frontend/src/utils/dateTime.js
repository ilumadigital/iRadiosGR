// One public-facing date policy. Financial timestamps and API payloads remain UTC/ISO.
export const ATHENS_TIME_ZONE = 'Europe/Athens';
const dateFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: ATHENS_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric'
});
const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: ATHENS_TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const localPartsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: ATHENS_TIME_ZONE, day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function validYmd(year, month, day) {
  const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return d.getUTCFullYear() === Number(year) &&
    d.getUTCMonth() + 1 === Number(month) &&
    d.getUTCDate() === Number(day);
}
function validTime(hour, minute) {
  return Number(hour) <= 23 && Number(minute) <= 59;
}
function asInstant(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const match = typeof value === 'string' && value.match(ISO_DATE);
  // A date-only value is a calendar day, not an instant in the visitor's timezone.
  const parsed = new Date(match ? value + 'T12:00:00Z' : value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}
export function formatDate(value, fallback = '—') {
  if (typeof value === 'string') {
    const match = value.match(ISO_DATE);
    if (match && validYmd(match[1], match[2], match[3]))
      return match[3] + '/' + match[2] + '/' + match[1];
  }
  const date = asInstant(value);
  return date ? dateFmt.format(date) : fallback;
}
export function formatTime(value, fallback = '—') {
  const date = asInstant(value);
  return date ? timeFmt.format(date) : fallback;
}
export function formatDateTime(value, fallback = '—') {
  if (typeof value === 'string' && ISO_LOCAL_DATETIME.test(value))
    return formatLocalDateTime(value, fallback);
  const date = asInstant(value);
  return date ? dateFmt.format(date) + ' ' + timeFmt.format(date) : fallback;
}
export function formatInputDate(value) {
  const match = typeof value === 'string' ? value.match(ISO_DATE) : null;
  return match && validYmd(match[1], match[2], match[3])
    ? match[3] + '/' + match[2] + '/' + match[1] : '';
}
export function parseGreekDate(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match || !validYmd(match[3], match[2], match[1])) return null;
  return match[3] + '-' + match[2] + '-' + match[1];
}
export function formatLocalDateTime(value, fallback = '') {
  const match = typeof value === 'string' && value.match(ISO_LOCAL_DATETIME);
  return match && validYmd(match[1], match[2], match[3]) &&
    validTime(match[4], match[5])
    ? match[3] + '/' + match[2] + '/' + match[1] + ' ' + match[4] + ':' + match[5]
    : fallback;
}
export function parseGreekDateTime(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/);
  if (!match || !validYmd(match[3], match[2], match[1]) ||
    !validTime(match[4], match[5])) return null;
  return match[3] + '-' + match[2] + '-' + match[1] + 'T' + match[4] + ':' + match[5];
}
export function toAthensLocalDateTime(value) {
  if (typeof value === 'string' && ISO_LOCAL_DATETIME.test(value)) return value;
  const date = asInstant(value);
  if (!date) return '';
  const p = Object.fromEntries(localPartsFmt.formatToParts(date)
    .filter(part => part.type !== 'literal')
    .map(part => [part.type, part.value]));
  return p.year + '-' + p.month + '-' + p.day + 'T' + p.hour + ':' + p.minute;
}
export function toAthensDateKey(value) {
  const formatted = formatDate(value, '');
  if (!formatted) return '';
  const [dd, mm, yyyy] = formatted.split('/');
  return yyyy + '-' + mm + '-' + dd;
}
