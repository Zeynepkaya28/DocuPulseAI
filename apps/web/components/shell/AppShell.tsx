"use client";
import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useIngestionStatus } from "@/hooks/useIngestionStatus";
import { Api } from "@/lib/api";
import { SECTIONS } from "@/lib/nav";
import { SessionProvider, useSession } from "@/lib/session";
import { JobsProvider } from "./JobsContext";
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
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </>
  );
}

function LiveJobs({ children }: { children: ReactNode }) {
  const { userId } = useSession();
  const jobs = useIngestionStatus(userId);
  const { setCollections } = useShell();
  useEffect(() => {
    if (userId) Api.collections().then(setCollections).catch(() => undefined);
  }, [userId, setCollections]);
  return <JobsProvider jobs={jobs}>{children}</JobsProvider>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ShellProvider>
        <LiveJobs>
          <ShellFrame>{children}</ShellFrame>
        </LiveJobs>
      </ShellProvider>
    </SessionProvider>
  );
}
