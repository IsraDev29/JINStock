/**
 * Utilidades de fecha para el frontend — Zona horaria Nicaragua (UTC-6)
 *
 * new Date().toISOString() siempre retorna UTC.
 * Cuando el usuario está en Nicaragua (UTC-6) y son las 7 PM del 31 de oct,
 * toISOString() retorna "2026-11-01T01:xx:xx.000Z" → fecha incorrecta.
 *
 * Usar estas funciones en su lugar.
 */

/**
 * Retorna la fecha de hoy como "YYYY-MM-DD" en la zona horaria de Nicaragua (America/Managua).
 * Garantiza que a las 8 PM del 31 de octubre retorna "2026-10-31" sin saltar a noviembre.
 */
export function localDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Retorna la fecha de hace N días en hora de Nicaragua como "YYYY-MM-DD".
 */
export function localDateStringDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localDateString(d);
}

/**
 * Retorna un string ISO con el offset exacto de Nicaragua (-06:00).
 * Ejemplo: "2026-10-31T20:55:00-06:00" en vez de saltar al 1 de noviembre UTC.
 */
export function nowISOStringNI(): string {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  let hour = get('hour');
  if (hour === '24') hour = '00';
  const minute = get('minute');
  const second = get('second');

  return `${year}-${month}-${day}T${hour}:${minute}:${second}-06:00`;
}

/**
 * Formatea un string ISO o Date a fecha legible en español Nicaragua.
 * Ej: "2026-10-31T19:00:00.000Z" → "31/10/2026"
 */
export function formatDateNI(dateStr: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleDateString('es-NI', {
    timeZone: 'America/Managua',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
  });
}

/**
 * Formatea un string ISO o Date a hora legible en español Nicaragua.
 * Ej: "2026-11-01T01:30:00.000Z" → "7:30 PM" (hora Nicaragua)
 */
export function formatTimeNI(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleTimeString('es-NI', {
    timeZone: 'America/Managua',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea un string ISO o Date a fecha+hora completa en Nicaragua.
 */
export function formatDateTimeNI(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  return date.toLocaleString('es-NI', {
    timeZone: 'America/Managua',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
