"use client";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Text } from "@/components/ui/Text";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const field = "w-full min-h-[44px] rounded-control bg-fill-tertiary px-3 t-body text-label outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent))]";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/library";
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const sb = supabase();
      if (mode === "signin") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next.startsWith("/") ? next : "/library");
      } else {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) router.replace("/library");
        else setNotice("Hesabınız oluşturuldu. E-postanızdaki bağlantıyla hesabınızı doğrulayın, sonra giriş yapın.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(
        /invalid login/i.test(msg) ? "E-posta veya parola hatalı."
          : /already registered/i.test(msg) ? "Bu e-posta ile kayıtlı bir hesap var."
          : /password/i.test(msg) ? "Parola en az 6 karakter olmalı."
          : "Bağlantı kurulamadı. Lütfen tekrar deneyin.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    // Single centred column at readable width. // HIG: layout
    <main className="min-h-dvh grid place-items-center px-4 bg-bg-grouped">
      <div className="w-full max-w-sm space-y-6">
        <header className="text-center space-y-1">
          {/* App name as text — no SF Symbol used as a logo. // HIG: sf-symbols */}
          <Text variant="title1" emphasized as="h1">DocuPulse AI</Text>
          <Text variant="body" color="secondary" as="p">Dokümanlarınızdan bilgi grafiği ve kaynaklı yanıtlar</Text>
        </header>

        {!isSupabaseConfigured() && (
          <p role="alert" className="flex items-start gap-2 rounded-card bg-bg-secondary p-3 t-callout">
            <Icon name="exclamationmark.circle" className="text-status-error mt-0.5" />
            Supabase yapılandırılmamış. NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY değerlerini ayarlayın.
          </p>
        )}

        <form onSubmit={submit} className="space-y-3 rounded-card bg-bg-grouped-secondary p-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="t-subheadline text-label-secondary">E-posta</label>
            <input id="email" type="email" autoComplete="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="t-subheadline text-label-secondary">Parola</label>
            <input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={field}
              aria-describedby={error ? "login-error" : undefined} />
          </div>

          {/* Error = red + symbol + explanation; stays until the person closes it. // HIG: color, accessibility */}
          {error && (
            <div id="login-error" role="alert" className="flex items-start gap-2 rounded-control bg-fill-tertiary p-2.5">
              <Icon name="exclamationmark.circle" className="text-status-error mt-0.5" />
              <Text variant="callout" as="p" className="flex-1">{error}</Text>
              <button type="button" aria-label="Hatayı kapat" onClick={() => setError(null)}
                className="grid place-items-center w-7 h-7 rounded-full text-label-secondary hover:bg-fill">
                <Icon name="xmark" scale="small" />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="flex items-start gap-2 rounded-control bg-fill-tertiary p-2.5">
              <Icon name="checkmark.circle" className="text-status-done mt-0.5" />
              <Text variant="callout" as="p" className="flex-1">{notice}</Text>
              <button type="button" aria-label="Bildirimi kapat" onClick={() => setNotice(null)}
                className="grid place-items-center w-7 h-7 rounded-full text-label-secondary hover:bg-fill">
                <Icon name="xmark" scale="small" />
              </button>
            </div>
          )}

          {/* One primary action. // HIG: toolbars "only one primary action" */}
          <Button type="submit" variant="prominent" size="large" className="w-full min-h-[44px]" disabled={busy || !email || !password}>
            {busy ? "Lütfen bekleyin…" : mode === "signin" ? "Giriş Yap" : "Kayıt Ol"}
          </Button>
        </form>

        <p className="text-center t-callout text-label-secondary">
          {mode === "signin" ? "Hesabınız yok mu?" : "Zaten hesabınız var mı?"}{" "}
          <button type="button" className="text-link underline-offset-2 hover:underline min-h-[28px]"
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}>
            {mode === "signin" ? "Hesap oluştur" : "Giriş yap"}
          </button>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
