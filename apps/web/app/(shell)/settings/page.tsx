"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { OptionRow, SettingsGroup, SettingsRow } from "@/components/settings/SettingsGroup";
import { Toolbar } from "@/components/shell/Toolbar";
import { AlertDialog } from "@/components/ui/AlertDialog";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ProgressBar } from "@/components/ui/Progress";
import { Text } from "@/components/ui/Text";
import { formatBytes } from "@/components/library/docTypes";
import { formatDate } from "@/components/library/StatusLabel";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";

interface MySettings {
  id: string;
  email: string;
  display_name: string | null;
  role: "admin" | "editor" | "viewer";
  llm_provider: "openai" | "ollama" | "fake";
  openai_configured: boolean;
  usage: { documents: number; bytes: number; chunks: number };
  storage_limit_bytes: number;
}
interface UserRow { id: string; name: string; email: string; role: MySettings["role"]; last_sign_in_at: string | null }

type Theme = "system" | "light" | "dark";
const ROLE_LABEL = { admin: "Yönetici", editor: "Düzenleyici", viewer: "Görüntüleyici" } as const;

function readPref(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writePref(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice still applies for this visit */
  }
}

function UsersTable({ me }: { me: string }) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [sort, setSort] = useState<{ key: "name" | "role" | "last_sign_in_at"; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<UserRow[]>("/admin/users").then(setRows).catch((e) => setError(e.message));
  }, []);

  const sorted = useMemo(
    () => [...rows].sort((a, b) => ((a[sort.key] ?? "") < (b[sort.key] ?? "") ? -1 : 1) * sort.dir),
    [rows, sort],
  );
  const head = (key: typeof sort.key, title: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className="text-left p-0">
      <button type="button" className="hit w-full text-left px-4 t-subheadline t-emphasized text-label-secondary inline-flex items-center gap-1"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((s.dir * -1) as 1 | -1) : 1 }))}>
        {title}
        {sort.key === key && <Icon name={sort.dir === 1 ? "chevron.up" : "chevron.down"} scale="small" />}
      </button>
    </th>
  );

  if (error) return <SettingsRow label={<span className="inline-flex items-center gap-1"><Icon name="exclamationmark.triangle" className="text-status-error" />{error}</span>} />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full t-body" aria-label="Kullanıcılar ve roller">
        <thead><tr className="border-b border-separator">{head("name", "Kullanıcı")}{head("role", "Rol")}{head("last_sign_in_at", "Son Giriş")}</tr></thead>
        <tbody>
          {sorted.map((u) => (
            <tr key={u.id} className="border-b border-separator last:border-0">
              <td className="px-4 py-2"><span className="block">{u.name}</span><span className="block t-footnote text-label-secondary">{u.email}</span></td>
              <td className="px-4 py-2">
                <label className="sr-only" htmlFor={`role-${u.id}`}>{u.name} rolü</label>
                <select id={`role-${u.id}`} value={u.role}
                  onChange={async (e) => {
                    const role = e.target.value as UserRow["role"];
                    try {
                      await api(`/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
                      setRows((rs) => rs.map((r) => (r.id === u.id ? { ...r, role } : r)));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Rol değiştirilemedi");
                    }
                  }}
                  className="hit rounded-control bg-fill-tertiary px-2 t-body text-label">
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}{u.id === me && v === u.role ? " (siz)" : ""}</option>)}
                </select>
              </td>
              <td className="px-4 py-2 text-label-secondary whitespace-nowrap">{u.last_sign_in_at ? formatDate(u.last_sign_in_at) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { userId } = useSession();
  const [me, setMe] = useState<MySettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>("system");
  const [contrast, setContrast] = useState(false);
  const [name, setName] = useState("");
  const [danger, setDanger] = useState<null | { kind: "graph" | "account"; step: 1 | 2 }>(null);
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setTheme((readPref("dp-theme") as Theme) ?? "system");
    setContrast(readPref("dp-contrast") === "more");
  }, []);

  useEffect(() => {
    if (!userId) return;
    api<MySettings>("/me/settings").then((s) => { setMe(s); setName(s.display_name ?? ""); }).catch((e) => setError(e.message));
  }, [userId]);

  function applyTheme(t: Theme) {
    setTheme(t);
    writePref("dp-theme", t === "system" ? null : t);
    if (t === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }
  function applyContrast(on: boolean) {
    setContrast(on);
    writePref("dp-contrast", on ? "more" : null);
    if (on) document.documentElement.dataset.contrast = "more";
    else delete document.documentElement.dataset.contrast;
  }

  async function runDanger() {
    if (!danger) return;
    if (danger.kind === "graph") {
      const r = await api<{ documents: number }>("/me/graph/reset", { method: "POST" });
      setDone(`${r.documents} dokümanın graf verisi silindi.`);
    } else {
      await api("/me", { method: "DELETE" });
      await supabase().auth.signOut();
      router.replace("/login");
    }
    setDanger(null);
    setTyped("");
  }

  const CONFIRM_WORD = "SİL";

  return (
    <>
      <Toolbar title="Ayarlar" search={null} />
      <div className="bg-bg-grouped min-h-[calc(100dvh-var(--toolbar-height))] px-4 py-4">
        <div className="max-w-readable mx-auto space-y-7">
          {error && (
            <p role="alert" className="flex items-center gap-2 t-callout"><Icon name="exclamationmark.circle" className="text-status-error" />{error}</p>
          )}
          {!me && !error && <ProgressBar label="Ayarlar yükleniyor" />}

          {me && (
            <SettingsGroup title="Hesap" id="g-account">
              <SettingsRow label="E-posta" value={me.email} symbol="envelope" />
              <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
                <Icon name="person.crop.circle" className="text-accent" />
                <label htmlFor="display-name" className="t-body flex-1">Görünen ad</label>
                <input id="display-name" value={name} onChange={(e) => setName(e.target.value)}
                  onBlur={() => name !== (me.display_name ?? "") && api("/me", { method: "PATCH", body: JSON.stringify({ display_name: name }) })}
                  className="hit rounded-control bg-fill-tertiary px-2 t-body text-label text-right w-44" />
              </div>
              <SettingsRow label="Rol" value={ROLE_LABEL[me.role]} symbol="key" />
              <div className="px-4 py-2">
                <Button icon="rectangle.portrait.and.arrow.right" onClick={async () => { await supabase().auth.signOut(); router.replace("/login"); }}>
                  Çıkış Yap
                </Button>
              </div>
            </SettingsGroup>
          )}

          <SettingsGroup title="Görünüm" id="g-appearance" footer="Sistem seçeneği cihazınızın açık/koyu ayarını izler.">
            <div role="radiogroup" aria-label="Tema">
              <OptionRow label="Sistem" checked={theme === "system"} onSelect={() => applyTheme("system")} />
              <OptionRow label="Açık" checked={theme === "light"} onSelect={() => applyTheme("light")} />
              <OptionRow label="Koyu" checked={theme === "dark"} onSelect={() => applyTheme("dark")} />
            </div>
            <label className="flex items-center gap-3 px-4 min-h-[44px] py-2">
              <span className="flex-1">
                <span className="block t-body">Kontrastı Artır</span>
                <span className="block t-footnote text-label-secondary">Önizleme; sistem ayarı açıksa her zaman uygulanır</span>
              </span>
              <input type="checkbox" role="switch" checked={contrast} onChange={(e) => applyContrast(e.target.checked)}
                className="w-11 h-6 accent-[rgb(var(--accent-fill))]" />
            </label>
            {/* Preview swatches with the status colors in the current mode. */}
            <div className="flex flex-wrap gap-3 px-4 py-3" aria-label="Renk önizlemesi">
              {[["arrow.clockwise", "text-status-processing", "İşleniyor"], ["checkmark.circle", "text-status-done", "Tamamlandı"],
                ["exclamationmark.triangle", "text-status-warning", "Çelişki"], ["exclamationmark.triangle", "text-status-error", "Hata"]].map(([s, c, l]) => (
                <span key={l} className="inline-flex items-center gap-1 t-callout"><Icon name={s} className={c} />{l}</span>
              ))}
            </div>
          </SettingsGroup>

          {me && (
            <SettingsGroup title="Model" id="g-model"
              footer="Sağlayıcı sunucuda LLM_PROVIDER ile seçilir. Ollama yalnızca yerel geliştirmede çalışır; Vercel'de yerel model koşmaz.">
              <div role="radiogroup" aria-label="Model sağlayıcı">
                <OptionRow label="OpenAI" detail="Canlı ortam" checked={me.llm_provider === "openai"} disabled onSelect={() => undefined} />
                <OptionRow label="Ollama (yerel)" detail="Yalnızca yerel geliştirme" checked={me.llm_provider === "ollama"} disabled onSelect={() => undefined} />
                {me.llm_provider === "fake" && <OptionRow label="Çevrimdışı test sağlayıcısı" detail="API anahtarı olmadan" checked disabled onSelect={() => undefined} />}
              </div>
            </SettingsGroup>
          )}

          {me && (
            <SettingsGroup title="API Anahtarları" id="g-keys"
              footer="Anahtarlar sunucuda ortam değişkeni olarak tutulur ve tarayıcıya hiç gönderilmez.">
              <SettingsRow label="OpenAI" symbol="key"
                value={<span className="inline-flex items-center gap-1">
                  <Icon name={me.openai_configured ? "checkmark.circle" : "exclamationmark.circle"}
                    className={me.openai_configured ? "text-status-done" : "text-status-warning"} />
                  {me.openai_configured ? "Yapılandırıldı" : "Eksik"}
                </span>} />
            </SettingsGroup>
          )}

          {me?.role === "admin" && (
            <SettingsGroup title="Kullanıcılar ve Roller" id="g-users" footer="Görüntüleyiciler doküman yükleyemez veya silemez.">
              <UsersTable me={me.id} />
            </SettingsGroup>
          )}

          {me && (
            <SettingsGroup title="Depolama" id="g-storage">
              <div className="px-4 py-3 space-y-2">
                <ProgressBar value={me.usage.bytes / me.storage_limit_bytes} label="Depolama kullanımı" />
                <Text variant="footnote" color="secondary" as="p">
                  {formatBytes(me.usage.bytes)} / {formatBytes(me.storage_limit_bytes)} kullanılıyor
                </Text>
              </div>
              <SettingsRow label="Doküman" value={me.usage.documents} symbol="doc.on.doc" />
              <SettingsRow label="Parça" value={me.usage.chunks} symbol="text.quote" />
            </SettingsGroup>
          )}

          {/* Destructive actions get their own group (not buried at the bottom of another) and a double confirmation. // HIG: accessibility */}
          {me && (
            <SettingsGroup title="Tehlikeli İşlemler" id="g-danger" footer="Bu işlemler geri alınamaz.">
              <div className="px-4 py-3 flex flex-wrap gap-2">
                <Button variant="destructive" icon="point.3.connected.trianglepath.dotted" onClick={() => setDanger({ kind: "graph", step: 1 })}>
                  Tüm Grafı Sıfırla
                </Button>
                <Button variant="destructive" icon="trash" onClick={() => setDanger({ kind: "account", step: 1 })}>
                  Hesabı Sil
                </Button>
              </div>
              {done && (
                <div role="status" className="flex items-center gap-2 px-4 py-2">
                  <Icon name="checkmark.circle" className="text-status-done" /><Text variant="callout" className="flex-1">{done}</Text>
                  <Button variant="plain" size="small" icon="xmark" iconOnly onClick={() => setDone(null)}>Kapat</Button>
                </div>
              )}
            </SettingsGroup>
          )}
        </div>
      </div>

      <AlertDialog
        open={danger?.step === 1}
        title={danger?.kind === "graph" ? "Tüm graf sıfırlansın mı?" : "Hesabınız silinsin mi?"}
        message={danger?.kind === "graph"
          ? "Tüm varlıklar ve ilişkiler silinir. Dokümanlar ve pasajlar kalır."
          : "Hesabınız, tüm dokümanlarınız, sohbetleriniz ve grafınız kalıcı olarak silinir."}
        confirmLabel="Devam Et"
        cancelLabel="Vazgeç"
        destructive
        onCancel={() => setDanger(null)}
        onConfirm={() => setDanger((d) => (d ? { ...d, step: 2 } : d))}
      />
      <AlertDialog
        open={danger?.step === 2}
        title="Son onay"
        message={
          <div className="space-y-2 text-left">
            <p>Onaylamak için <strong>{CONFIRM_WORD}</strong> yazın.</p>
            <label htmlFor="confirm-word" className="sr-only">Onay kelimesi</label>
            <input id="confirm-word" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
              className="w-full min-h-[36px] rounded-control bg-fill-tertiary px-2 t-body text-label" />
          </div>
        }
        confirmLabel={danger?.kind === "graph" ? "Grafı Sıfırla" : "Hesabı Sil"}
        cancelLabel="Vazgeç"
        destructive
        confirmDisabled={typed.trim().toLocaleUpperCase("tr") !== CONFIRM_WORD}
        onCancel={() => { setDanger(null); setTyped(""); }}
        onConfirm={runDanger}
      />
    </>
  );
}
