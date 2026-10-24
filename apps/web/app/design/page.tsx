import { Button } from "@/components/ui/Button";
import { Glass } from "@/components/ui/Glass";
import { Icon } from "@/components/ui/Icon";
import { Text, type TextStyle } from "@/components/ui/Text";

const STYLES: TextStyle[] = [
  "largeTitle", "title1", "title2", "title3", "headline", "body",
  "callout", "subheadline", "footnote", "caption1", "caption2",
];
const COLORS = ["red", "orange", "yellow", "green", "mint", "teal", "cyan", "blue", "indigo", "purple", "pink", "brown", "gray"];

/** Token gallery for visual QA (Faz A0). Not linked from the app navigation. */
export default function DesignPage() {
  return (
    <main className="mx-auto max-w-readable p-6 space-y-8">
      <Text variant="largeTitle">Tasarım Sistemi</Text>
      <section className="space-y-1">
        {STYLES.map((s) => (
          <Text key={s} as="p" variant={s}>{s} — Dokümanlarınıza bir soru sorun</Text>
        ))}
      </section>
      <section className="grid grid-cols-4 regular:grid-cols-7 gap-3">
        {COLORS.map((c) => (
          <div key={c} className="space-y-1">
            <div className="h-10 rounded-control" style={{ background: `rgb(var(--c-${c}))` }} />
            <Text variant="caption1" color="secondary">{c}</Text>
          </div>
        ))}
      </section>
      <section className="flex flex-wrap gap-3 items-center">
        <Button variant="prominent" icon="square.and.arrow.up">Yükle</Button>
        <Button icon="arrow.clockwise">Tekrar Dene</Button>
        <Button variant="plain" icon="sidebar.leading" iconOnly>Kenar çubuğu</Button>
        <Button variant="destructive" icon="trash">Sil</Button>
      </section>
      <section className="flex gap-4 items-center t-title2">
        <Icon name="doc.on.doc" /> <Icon name="doc.on.doc.fill" /> <Icon name="magnifyingglass.slash" />
        <Icon name="arrow.up.circle.fill" className="text-accent" /> <Icon name="cpu" variableValue={0.6} />
      </section>
      <section className="relative h-40 rounded-card overflow-hidden" style={{ background: "linear-gradient(135deg, rgb(var(--c-teal)), rgb(var(--c-indigo)))" }}>
        <Glass className="absolute left-4 top-4 rounded-card p-3"><Text>Glass regular</Text></Glass>
        <Glass variant="clear" dim className="absolute right-4 bottom-4 rounded-card p-3"><Text>Glass clear + dim</Text></Glass>
      </section>
      <section className="flex flex-wrap gap-4">
        <span className="inline-flex items-center gap-1 text-label"><Icon name="arrow.clockwise" className="text-status-processing" />İşleniyor</span>
        <span className="inline-flex items-center gap-1 text-label"><Icon name="checkmark.circle" className="text-status-done" />Tamamlandı</span>
        <span className="inline-flex items-center gap-1 text-label"><Icon name="exclamationmark.triangle" className="text-status-warning" />Çelişki</span>
        <span className="inline-flex items-center gap-1 text-label"><Icon name="exclamationmark.triangle" className="text-status-error" />Hata</span>
      </section>
    </main>
  );
}
