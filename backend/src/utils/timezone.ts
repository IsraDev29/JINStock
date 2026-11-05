/**
 * Utilidades de Zona Horaria para Nicaragua (America/Managua — UTC-6, sin horario de verano)
 *
 * El servidor corre en UTC (Neon/Render). Todas las fechas almacenadas en PostgreSQL
 * son UTC. Este módulo convierte correctamente entre la hora local de Nicaragua y UTC
 * para que los filtros y estadísticas coincidan con el calendario del usuario.
 */

/** Offset de Nicaragua respecto a UTC en minutos (-360 = UTC-6) */
const MANAGUA_OFFSET_MINUTES = -6 * 60;

/**
 * Retorna la fecha actual en hora de Nicaragua como objeto Date
 * (el .getUTC*() dará los valores de hora local de Nicaragua)
 */
export function nowInManagua(): Date {
  const utcMs = Date.now();
  return new Date(utcMs + MANAGUA_OFFSET_MINUTES * 60_000);
}

/**
 * Retorna la cadena YYYY-MM-DD de hoy en hora de Nicaragua.
 * A las 7 PM del 31 de octubre en Nicaragua (1 AM UTC del 1 de noviembre),
 * retorna "2026-10-31" en lugar de "2026-11-01".
 */
export function todayStringInManagua(): string {
  const local = nowInManagua();
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Dado un string "YYYY-MM-DD" interpretado como fecha en Nicaragua,
 * retorna el Date UTC correspondiente al inicio de ese día (00:00:00 Managua = 06:00:00 UTC).
 */
export function dayStartUTC(dateStr: string): Date {
  // "2026-10-31" → midnight Managua → 06:00 UTC
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create midnight in Managua as a UTC timestamp
  const midnightManahuaAsUTC = Date.UTC(year, month - 1, day); // This is midnight UTC for that calendar date
  // Shift: midnight UTC for that date is offset by MANAGUA_OFFSET_MINUTES relative to Managua midnight
  // Managua midnight in UTC = midnight_date_UTC - MANAGUA_OFFSET_MINUTES * 60000
  //   = midnight_date_UTC - (-360 * 60000) = midnight_date_UTC + 21600000 (+ 6 hours)
  return new Date(midnightManahuaAsUTC - MANAGUA_OFFSET_MINUTES * 60_000);
}

/**
 * Dado un string "YYYY-MM-DD", retorna el Date UTC correspondiente
 * al fin del día en Nicaragua (23:59:59.999 Managua = 05:59:59.999 UTC siguiente día).
 */
export function dayEndUTC(dateStr: string): Date {
  const start = dayStartUTC(dateStr);
  return new Date(start.getTime() + 24 * 60 * 60_000 - 1); // + 24h - 1ms
}

/**
 * Retorna un par [todayStart, monthStart] en UTC para consultas de
 * "hoy" y "este mes" calculadas en hora Nicaragua.
 */
export function getDashboardDateBoundsUTC(): { todayStart: Date; monthStart: Date } {
  const local = nowInManagua();
  const todayStr = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  const monthStr = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-01`;

  return {
    todayStart: dayStartUTC(todayStr),
    monthStart: dayStartUTC(monthStr),
  };
}
