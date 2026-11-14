import { describe, expect, it } from 'vitest';
import { addWords, currentStreak, dateKey, recentDays, wordsToday } from './writingLog';

const day = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12);

describe('writingLog', () => {
  it('uses local calendar dates as keys', () => {
    expect(dateKey(day(2026, 3, 7))).toBe('2026-03-07');
  });

  it('accumulates net words per day and never reports a negative day', () => {
    const now = day(2026, 3, 7);
    let log = addWords({}, 120, now);
    log = addWords(log, -20, now);
    expect(wordsToday(log, now)).toBe(100);
    log = addWords(log, -500, now);
    expect(wordsToday(log, now)).toBe(0);
    expect(addWords(log, 0, now)).toBe(log);
  });

  it('counts a streak through yesterday when today is still empty', () => {
    const log = { '2026-03-04': 300, '2026-03-05': 10, '2026-03-06': 800 };
    expect(currentStreak(log, day(2026, 3, 7))).toBe(3);
    expect(currentStreak({ ...log, '2026-03-07': 5 }, day(2026, 3, 7))).toBe(4);
    expect(currentStreak(log, day(2026, 3, 9))).toBe(0);
  });

  it('lists recent days oldest first', () => {
    const days = recentDays({ '2026-03-07': 50 }, 3, day(2026, 3, 7));
    expect(days.map((d) => d.key)).toEqual(['2026-03-05', '2026-03-06', '2026-03-07']);
    expect(days[2].words).toBe(50);
  });
});
