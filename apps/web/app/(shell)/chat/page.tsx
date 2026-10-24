"use client";
import { Toolbar } from "@/components/shell/Toolbar";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ChatPage() {
  return (
    <>
      <Toolbar title="Sohbet" />
      <EmptyState symbol="bubble.left.and.text.bubble.right" title="Henüz sohbet yok" message="Doküman yükledikten sonra sorularınızı burada sorabilirsiniz." />
    </>
  );
}
