import type { ReactNode } from "react";
import { Icon } from "./Icon";
import { Text } from "./Text";

/** Explains WHY a view is empty instead of hiding or disabling the tab. // HIG: tab-bars */
export function EmptyState({ symbol, title, message, action }: { symbol: string; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center gap-2 py-16 px-6">
      <Icon name={symbol} scale="large" className="text-label-tertiary t-largeTitle" />
      <Text variant="title3" emphasized as="h2">{title}</Text>
      {message && <Text variant="body" color="secondary" as="p" className="max-w-sm">{message}</Text>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
