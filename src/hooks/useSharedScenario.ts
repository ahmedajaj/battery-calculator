import { useState, useEffect, useCallback, useRef } from 'react';

const SCENARIO_URL = `${import.meta.env.BASE_URL}data/scenario.json`;
const STORAGE_KEY_PIN = 'battery-calc-pin';

export interface SharedScenario {
  scenarioId: string | null;
  scenarioName: string | null;
  scenarioTag: string | null;
  scenarioDescription: string | null;
  updatedAt: string | null;
}

export interface UseSharedScenarioReturn {
  /** Currently published scenario (fetched from server) */
  shared: SharedScenario;
  /** Whether the initial fetch is in progress */
  loading: boolean;
  /** Last fetch error */
  error: string | null;
  /** Save a scenario to the server (requires PIN) */
  save: (scenario: SharedScenario) => Promise<boolean>;
  /** Re-fetch the shared scenario */
  refetch: () => void;
  /** The stored admin PIN (persisted in localStorage) */
  pin: string;
  /** Update the stored PIN */
  setPin: (pin: string) => void;
  /** Whether the last save failed due to auth (wrong PIN) */
  authError: boolean;
}

const EMPTY: SharedScenario = { scenarioId: null, scenarioName: null, scenarioTag: null, scenarioDescription: null, updatedAt: null };

export function useSharedScenario(pollInterval = 60_000): UseSharedScenarioReturn {
  const [shared, setShared] = useState<SharedScenario>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState(false);
  const [pin, setPinState] = useState(() => localStorage.getItem(STORAGE_KEY_PIN) || '');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setPin = useCallback((p: string) => {
    setPinState(p);
    localStorage.setItem(STORAGE_KEY_PIN, p);
    setAuthError(false);
  }, []);

  const fetchScenario = useCallback(async () => {
    try {
      const res = await fetch(SCENARIO_URL, { signal: AbortSignal.timeout(5_000), cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as SharedScenario;
      setShared(data);
      setError(null);
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Failed to fetch scenario');
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for updates
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch for polling subscription
    fetchScenario();
    intervalRef.current = setInterval(fetchScenario, pollInterval);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchScenario, pollInterval]);

  const save = useCallback(async (scenario: SharedScenario): Promise<boolean> => {
    setAuthError(false);
    try {
      const res = await fetch(SCENARIO_URL, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + btoa(`admin:${pin}`),
        },
        body: JSON.stringify(scenario),
      });

      if (res.status === 401) {
        setAuthError(true);
        return false;
      }
      if (!res.ok) {
        setError(`Save failed: HTTP ${res.status}`);
        return false;
      }

      setShared(scenario);
      setError(null);
      return true;
    } catch (e: unknown) {
      const err = e as Error;
      setError(err.message || 'Failed to save scenario');
      return false;
    }
  }, [pin]);

  return {
    shared,
    loading,
    error,
    save,
    refetch: fetchScenario,
    pin,
    setPin,
    authError,
  };
}
