import { useRef, useEffect, useCallback } from 'react';

export function useSafeTimeout() {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(
    () => () => {
      for (const id of timers.current) {
        clearTimeout(id);
      }
    },
    [],
  );

  return useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current = timers.current.filter((t) => t !== id);
      fn();
    }, ms);
    timers.current = [...timers.current, id];
    return id;
  }, []);
}
