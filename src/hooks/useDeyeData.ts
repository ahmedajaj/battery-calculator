import { useState, useEffect, useCallback, useRef } from 'react';
import type { BatteryMode } from '../types';

/**
 * Proxy URL — nginx (prod) or Vite dev server injects the Deye Bearer token
 * server-side, so NO secret ever reaches the browser.
 */
const PROXY_URL = `${import.meta.env.BASE_URL}api/deye/latest`;

const STORAGE_KEY_BATTERY_MODE = 'battery-calc-battery-mode';

export interface UseDeyeDataReturn {
  mode: BatteryMode;
  setMode: (mode: BatteryMode) => void;
  soc: number | null;
  /** Battery power in watts: negative = charging, positive = discharging, 0 = idle */
  batteryPower: number | null;
  /** Timestamp from the Deye inverter (when the data was recorded) */
  deyeTimestamp: Date | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refetch: () => void;
  tokenConfigured: boolean;
}

export function useDeyeData(pollInterval = 60_000): UseDeyeDataReturn {
  const stationId = (import.meta.env.VITE_DEYE_STATION_ID as string) || '61180551';
  // Token is injected server-side; we assume it's configured if station ID is set
  const tokenConfigured = stationId.length > 0;

  const [mode, setModeState] = useState<BatteryMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_BATTERY_MODE) as BatteryMode;
    if (saved === 'deye' || saved === 'manual') return saved;
    return tokenConfigured ? 'deye' : 'manual';
  });

  const [soc, setSOC] = useState<number | null>(null);
  const [batteryPower, setBatteryPower] = useState<number | null>(null);
  const [deyeTimestamp, setDeyeTimestamp] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setMode = useCallback((m: BatteryMode) => {
    setModeState(m);
    localStorage.setItem(STORAGE_KEY_BATTERY_MODE, m);
    if (m === 'manual') {
      setError(null);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId: parseInt(stationId, 10) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const batterySOC = json?.data?.batterySOC ?? json?.batterySOC;
      if (typeof batterySOC !== 'number' && typeof batterySOC !== 'string') {
        throw new Error('batterySOC не знайдено у відповіді');
      }

      const socValue = typeof batterySOC === 'string' ? parseFloat(batterySOC) : batterySOC;
      if (isNaN(socValue)) throw new Error('Невірне значення batterySOC');

      // Battery power (watts): negative = charging, positive = discharging
      const rawPower = json?.data?.batteryPower ?? json?.batteryPower ?? null;
      const powerValue = rawPower !== null ? (typeof rawPower === 'string' ? parseFloat(rawPower) : rawPower) : null;

      // Inverter timestamp (Unix seconds)
      const rawTime = json?.data?.lastUpdateTime ?? json?.lastUpdateTime ?? null;
      const tsValue = rawTime !== null ? new Date((typeof rawTime === 'string' ? parseFloat(rawTime) : rawTime) * 1000) : null;

      setSOC(socValue);
      setBatteryPower(typeof powerValue === 'number' && !isNaN(powerValue) ? powerValue : null);
      setDeyeTimestamp(tsValue);
      setError(null);
      setLastUpdated(new Date());
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || "Помилка з'єднання");
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  // Poll when in deye mode
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    if (mode === 'deye' && tokenConfigured) {
      fetchData();
      intervalRef.current = setInterval(fetchData, pollInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mode, tokenConfigured, pollInterval, fetchData]);

  return {
    mode,
    setMode,
    soc,
    batteryPower,
    deyeTimestamp,
    loading,
    error,
    lastUpdated,
    refetch: fetchData,
    tokenConfigured,
  };
}
