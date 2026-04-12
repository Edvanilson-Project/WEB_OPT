import { useState, useEffect } from "react";

/**
 * Debounce a value by the given delay (ms).
 * Usage:
 *   const [raw, setRaw] = useState("");
 *   const debounced = useDebounce(raw, 300);
 *   // use `debounced` for filtering / API calls
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
