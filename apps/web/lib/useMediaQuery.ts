"use client";
import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

/** Regular width size class. Layout follows size class, not device type. // HIG: layout */
export const useIsRegular = () => useMediaQuery("(min-width: 768px)", true);
export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");
