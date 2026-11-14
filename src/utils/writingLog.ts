/**
 * Per-day writing log: net words added to the manuscript on each calendar day.
 * Keys are local dates (`YYYY-MM-DD`) so "today" matches the writer's own day.
 */
export type WritingLog = Record<string, number>;

export function dateKey(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Words written today, never shown as negative (a day of cutting is a zero, not a debt). */
export function wordsToday(log: WritingLog, now: Date = new Date()): number {
  return Math.max(0, log[dateKey(now)] || 0);
}

export function addWords(log: WritingLog, delta: number, now: Date = new Date()): WritingLog {
  if (!delta) return log;
  const key = dateKey(now);
  return { ...log, [key]: (log[key] || 0) + delta };
}

/**
 * Consecutive days with at least one net word written. Today counts if it has words;
 * a still-empty today does not break a streak that ran through yesterday.
 */
export function currentStreak(log: WritingLog, now: Date = new Date()): number {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if ((log[dateKey(day)] || 0) <= 0) {
    day.setDate(day.getDate() - 1);
  }
  let streak = 0;
  while ((log[dateKey(day)] || 0) > 0) {
    streak += 1;
    day.setDate(day.getDate() - 1);
  }
  return streak;
}

/** The last `days` days, oldest first, for a small history chart. */
export function recentDays(
  log: WritingLog,
  days: number,
  now: Date = new Date()
): { key: string; words: number; date: Date }[] {
  const result: { key: string; words: number; date: Date }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = dateKey(d);
    result.push({ key, words: Math.max(0, log[key] || 0), date: d });
  }
  return result;
}
