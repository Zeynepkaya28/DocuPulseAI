"use client";
import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { SECTIONS } from "@/lib/nav";
import { JobsProvider, type JobView } from "./JobsContext";
import { ShellProvider, useShell } from "./ShellContext";
import { Sidebar } from "./Sidebar";
import { TabBar } from "./TabBar";

function ShellFrame({ children }: { children: ReactNode }) {
  const { isRegular, sidebarOpen } = useShell();
  const router = useRouter();

  // ⌘/Ctrl + 1..4 switches sections. // HIG: accessibility (keyboard)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const s = SECTIONS.find((x) => x.shortcut === e.key);
      if (s) {
        e.preventDefault();
        router.push(s.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <>
      <a href="#main" className="sr-only-focusable fixed left-2 top-2 z-50 rounded-control bg-bg-secondary px-3 py-2 t-body">
        İçeriğe atla
      </a>
      <Suspense fallback={null}>{isRegular ? <Sidebar /> : <TabBar />}</Suspense>
      {/* Content extends beneath the floating sidebar; only the reading column shifts. // HIG: sidebars, layout */}
      <div
        id="main"
        className="min-h-dvh transition-[padding] duration motion-transform"
        style={{
          paddingLeft: isRegular && sidebarOpen ? "calc(var(--sidebar-width) + 8px)" : 0,
          paddingBottom: isRegular ? 0 : "calc(var(--tabbar-height) + 24px + env(safe-area-inset-bottom))",
        }}
      >
        {children}
      </div>
    </>
  );
}

export function AppShell({ children, jobs = [] }: { children: ReactNode; jobs?: JobView[] }) {
  return (
    <ShellProvider>
      <JobsProvider jobs={jobs}>
        <ShellFrame>{children}</ShellFrame>
      </JobsProvider>
    </ShellProvider>
  );
}
