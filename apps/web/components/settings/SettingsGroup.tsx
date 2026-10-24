import type { ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";

/** Inset-grouped section on systemGroupedBackground. // HIG: lists-and-tables, color */
export function SettingsGroup({ title, footer, children, id }: { title: string; footer?: ReactNode; children: ReactNode; id?: string }) {
  return (
    <section aria-labelledby={id} className="space-y-1.5">
      <Text id={id} variant="footnote" emphasized color="secondary" as="h2" className="px-4 uppercase tracking-wide">{title}</Text>
      <div className="rounded-card bg-bg-grouped-secondary overflow-hidden divide-y divide-separator">{children}</div>
      {footer && <Text variant="footnote" color="secondary" as="div" className="px-4">{footer}</Text>}
    </section>
  );
}

export function SettingsRow({ label, value, children, symbol }: { label: ReactNode; value?: ReactNode; children?: ReactNode; symbol?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
      {symbol && <Icon name={symbol} className="text-accent" />}
      <span className="t-body text-label flex-1 min-w-0">{label}</span>
      {value !== undefined && <span className="t-body text-label-secondary text-right">{value}</span>}
      {children}
    </div>
  );
}

/** Option row: selection shown by a short highlight + checkmark. // HIG: lists-and-tables */
export function OptionRow({ label, detail, checked, disabled, onSelect }: {
  label: string; detail?: string; checked: boolean; disabled?: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 min-h-[44px] py-2 text-left active:bg-fill disabled:opacity-50 transition-colors"
    >
      <span className="flex-1 min-w-0">
        <span className="block t-body text-label">{label}</span>
        {detail && <span className="block t-footnote text-label-secondary">{detail}</span>}
      </span>
      {checked && <Icon name="checkmark" weight="semibold" className="text-accent" label="Seçili" />}
    </button>
  );
}
