"use client";
import { Toolbar } from "@/components/shell/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";

export default function GraphPage() {
  return (
    <>
      <Toolbar title="Bilgi Grafiği" />
      <EmptyState symbol="point.3.connected.trianglepath.dotted" title="Graf henüz boş" message="Dokümanlar işlendikçe varlıklar ve ilişkiler burada görünür." />
    </>
  );
}
