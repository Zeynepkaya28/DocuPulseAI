"use client";
import { Toolbar } from "@/components/shell/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";

export default function SettingsPage() {
  return (
    <>
      <Toolbar title="Ayarlar" />
      <EmptyState symbol="gearshape" title="Ayarlar" message="Hesap, görünüm ve model ayarları." />
    </>
  );
}
