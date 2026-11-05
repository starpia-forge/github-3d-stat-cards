import { periodFromIndex, periodIndex, periodOf, type Period, type RepoActivity } from "./activity.js";

/** Share of the Band's x position given to calendar time; the rest follows cumulative Activity. */
export const CALENDAR_WEIGHT = 0.7;
/** Quiet runs longer than this many months become Rifts. */
export const RIFT_AFTER = 3;
/** A Rift's width in month-units, however long it lasts. */
export const RIFT_UNITS = 1.4;

const DAY = 86_400_000;

export interface Rift {
  /** First quiet period index. */
  from: number;
  /** Period index just after the quiet run. */
  to: number;
  months: number;
}

export interface MonthActivity {
  period: Period;
  commits: number;
  /** Commits per month; the current partial month is extrapolated from its daily rate. */
  rate: number;
}

export interface BandTime {
  /** Period index of the first Activity. */
  start: number;
  /** Fractional period index of today. */
  end: number;
  months: MonthActivity[];
  rifts: Rift[];
  /** Maps a fractional period index to the Band position, 0 (first Activity) … 1 (today). */
  pos(index: number): number;
}

/** The Band's time axis: 70% calendar time, 30% cumulative Activity, with Rifts shortened. */
export function buildBandTime(repos: RepoActivity[], now: Date): BandTime {
  const totals = new Map<number, number>();
  for (const r of repos) for (const [p, c] of Object.entries(r.months)) totals.set(periodIndex(p), (totals.get(periodIndex(p)) ?? 0) + c);
  const current = periodIndex(periodOf(now));
  const start = Math.min(current, ...totals.keys());
  const monthStart = Date.UTC(Math.floor(current / 12), current % 12, 1);
  const monthLength = Date.UTC(Math.floor(current / 12), (current % 12) + 1, 1) - monthStart;
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - monthStart) / monthLength));
  const end = current + elapsed;

  const months: MonthActivity[] = [];
  for (let i = start; i <= current; i++) {
    const commits = totals.get(i) ?? 0;
    // At least one day elapsed, so a commit in the first hours of a month is not extrapolated wildly.
    const rate = i === current ? (commits / Math.max(1, (elapsed * monthLength) / DAY)) * (monthLength / DAY) : commits;
    months.push({ period: periodFromIndex(i), commits, rate });
  }

  const rifts: Rift[] = [];
  for (let i = 0; i < months.length; ) {
    if (months[i]!.commits > 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < months.length && months[j]!.commits === 0) j++;
    if (j - i > RIFT_AFTER) rifts.push({ from: start + i, to: start + j, months: j - i });
    i = j;
  }

  // Month-unit width of each month: 1, a share of RIFT_UNITS inside a Rift, the elapsed part of today's month.
  const units = months.map((_, k) => {
    const i = start + k;
    const rift = rifts.find((r) => i >= r.from && i < r.to);
    const full = rift ? RIFT_UNITS / rift.months : 1;
    return i === current ? full * elapsed : full;
  });
  // Cumulative boundaries: U[k] and A[k] at the start of month k; the last entry is today.
  const U = [0];
  const A = [0];
  months.forEach((m, k) => {
    U.push(U[k]! + units[k]!);
    A.push(A[k]! + m.commits);
  });
  const uTotal = U[U.length - 1]!;
  const aTotal = A[A.length - 1]!;

  const pos = (index: number): number => {
    if (uTotal === 0) return 0;
    const k = Math.min(months.length - 1, Math.max(0, Math.floor(index - start)));
    const f = Math.min(1, Math.max(0, index - start - k));
    // Inside today's month, f runs over the elapsed part only.
    const frac = start + k === current ? (elapsed ? Math.min(1, f / elapsed) : 0) : f;
    const c = (U[k]! + (U[k + 1]! - U[k]!) * frac) / uTotal;
    const a = aTotal ? (A[k]! + (A[k + 1]! - A[k]!) * frac) / aTotal : c;
    return CALENDAR_WEIGHT * c + (1 - CALENDAR_WEIGHT) * a;
  };

  return { start, end, months, rifts, pos };
}
