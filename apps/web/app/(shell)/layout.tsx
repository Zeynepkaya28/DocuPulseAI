import { AppShell } from "@/components/shell/AppShell";

/**
 * App shell. Regular width → sidebar; compact width → floating tab bar.
 * Layout adapts to size class, not to device type. // HIG: layout
 */
export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
