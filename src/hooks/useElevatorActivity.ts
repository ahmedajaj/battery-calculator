import { useState, useEffect, useCallback, useRef } from 'react';

/** Deye station history (5-min snapshots), proxied like /latest so the token stays server-side */
const HISTORY_URL = `${import.meta.env.BASE_URL}api/deye/history`;
/** Live reading — often a different snapshot than the stored history, and it arrives sooner */
const LATEST_URL = `${import.meta.env.BASE_URL}api/deye/latest`;

/** A sample this far above the recent base load counts as the elevator moving */
const SPIKE_W = 1500;
/** Base load = lowest consumption over this window (rides are short, so most samples miss them) */
const BASELINE_WINDOW_MS = 30 * 60_000;
/** Live readings closer than this to a history sample are the same snapshot */
const SAME_SAMPLE_S = 90;

export interface UseElevatorActivityReturn {
  /** Time of the latest sample with an elevator-sized spike (null if none seen today) */
  lastMovement: Date | null;
  /** Time of the latest history sample */
  lastSample: Date | null;
  error: string | null;
}

interface HistoryItem {
  timeStamp: number;
  consumptionPower: number | null;
}

/** YYYY-MM-DD in local time */
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function fetchDay(stationId: number, day: Date): Promise<HistoryItem[]> {
  const res = await fetch(HISTORY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stationId, granularity: 1, startAt: ymd(day), endAt: ymd(day) }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  return (json?.stationDataItems ?? []) as HistoryItem[];
}

/** Latest sample whose consumption jumps SPIKE_W above the lowest value of the preceding window */
export function findLastMovement(items: HistoryItem[]): Date | null {
  const samples = items
    .filter(i => typeof i.consumptionPower === 'number')
    .sort((a, b) => a.timeStamp - b.timeStamp);
  for (let k = samples.length - 1; k >= 0; k--) {
    const t = samples[k].timeStamp * 1000;
    let base = Infinity;
    for (let j = k; j >= 0 && t - samples[j].timeStamp * 1000 <= BASELINE_WINDOW_MS; j--) {
      base = Math.min(base, samples[j].consumptionPower as number);
    }
    if ((samples[k].consumptionPower as number) - base >= SPIKE_W) return new Date(t);
  }
  return null;
}

export function useElevatorActivity(pollInterval = 60_000): UseElevatorActivityReturn {
  const stationId = parseInt((import.meta.env.VITE_DEYE_STATION_ID as string) || '61180551', 10);
  const [lastMovement, setLastMovement] = useState<Date | null>(null);
  const [lastSample, setLastSample] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Live readings collected across polls, keyed by their timestamp (seconds)
  const liveSamples = useRef(new Map<number, number>());

  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch(LATEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return;
      const json = await res.json();
      const ts = Number(json?.data?.lastUpdateTime ?? json?.lastUpdateTime);
      const power = Number(json?.data?.consumptionPower ?? json?.consumptionPower);
      if (ts && !isNaN(power)) liveSamples.current.set(ts, power);
    } catch {
      // Live readings are a bonus — history alone still works
    }
  }, [stationId]);

  const fetchData = useCallback(async () => {
    try {
      const now = new Date();
      const [today] = await Promise.all([fetchDay(stationId, now), fetchLatest()]);
      let items = today;
      // Shortly after midnight today has too few samples for a baseline — prepend yesterday
      if (items.length < 7) {
        const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        items = [...(await fetchDay(stationId, yesterday)), ...items];
      }
      // Add live readings that history doesn't have; drop ones older than 2 h
      const live = liveSamples.current;
      for (const ts of live.keys()) if (now.getTime() / 1000 - ts > 2 * 3600) live.delete(ts);
      for (const [ts, power] of live) {
        if (!items.some(i => Math.abs(i.timeStamp - ts) < SAME_SAMPLE_S)) {
          items.push({ timeStamp: ts, consumptionPower: power });
        }
      }
      const latest = items.reduce((m, i) => Math.max(m, i.timeStamp), 0);
      setLastMovement(findLastMovement(items));
      setLastSample(latest ? new Date(latest * 1000) : null);
      setError(null);
    } catch (e: unknown) {
      setError((e as Error).message || "Помилка з'єднання");
    }
  }, [stationId, fetchLatest]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch for polling subscription
    fetchData();
    const id = setInterval(fetchData, pollInterval);
    return () => clearInterval(id);
  }, [fetchData, pollInterval]);

  return { lastMovement, lastSample, error };
}
