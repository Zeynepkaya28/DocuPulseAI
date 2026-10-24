"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useIsRegular, useMediaQuery } from "@/lib/useMediaQuery";

export interface Collection {
  id: string;
  name: string;
}

interface ShellState {
  isRegular: boolean;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  collections: Collection[];
  setCollections: (c: Collection[]) => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const isRegular = useIsRegular();
  const isWide = useMediaQuery("(min-width: 1024px)", true);
  // Sidebar is OPEN by default; people may hide it, but hidden is never the default. // HIG: sidebars
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const userHidden = useRef(false);
  const [collections, setCollections] = useState<Collection[]>([]);

  // Narrow window auto-hides the sidebar, widening restores it unless the user hid it. // HIG: sidebars
  useEffect(() => {
    if (!isWide) setSidebarOpen(false);
    else if (!userHidden.current) setSidebarOpen(true);
  }, [isWide]);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      userHidden.current = open;
      return !open;
    });
  }, []);

  const value = useMemo(
    () => ({ isRegular, sidebarOpen: isRegular && sidebarOpen, toggleSidebar, collections, setCollections }),
    [isRegular, sidebarOpen, toggleSidebar, collections],
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellState {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell must be used inside ShellProvider");
  return ctx;
}
