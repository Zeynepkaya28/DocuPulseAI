# HIG Denetimi (Faz A7)

**Sonuç: 15/15 madde GEÇTİ.** Denetim 24.10.2026'da yerel ortamda çalıştırıldı. Otomatik kontroller: `apps/web/e2e/hig.spec.ts` (Playwright + axe-core) ve `scripts/hig-lint.mjs` (statik). İkisi de CI'da her PR'da çalışır.

```bash
npm run e2e -w apps/web     # 375 px ve 1920 px × açık/koyu = 4 proje, 46 test
node scripts/hig-lint.mjs
```

Ekran görüntüleri: [`docs/hig-audit/screenshots/`](hig-audit/screenshots). Klasör adları `compact-light`, `compact-dark`, `regular-light` ve `regular-dark`; her birinde `library`, `chat`, `graph`, `settings` ve `login` görüntüleri var. Geniş ekranda ek olarak `library-drop` (sürükle-bırak vurgusu) bulunur. En küçük ve en büyük genişlik önce test edildi `[HIG: layout]`.

| # | Madde | Sonuç | Nasıl doğrulandı | Denetimde yapılan düzeltme |
|---|---|---|---|---|
| 1 | Glass yalnızca kontrol katmanında `[HIG: materials]` | GEÇTİ | Mesaj listesi, tablo, doküman listesi ve detay makalesinde `.glass` yok (modal dialog hariç) | — |
| 2 | Bileşenlerde hard-coded renk yok `[HIG: color]` | GEÇTİ | `hig-lint` (rgb/hex/hsl, `text-white` vb.) | Maske `#000` → `--mask-solid`, rozet `text-white` → `text-accent-on`, dialog arka planı → `--glass-dim`, düğüm ikon rengi → `--on-light` |
| 3 | Kontrast ≥ 4.5:1 / ≥ 3:1 (açık, koyu, artırılmış kontrast) `[HIG: accessibility]` | GEÇTİ | axe `color-contrast`: 4 ekran + giriş, açık ve koyu modda. Artırılmış kontrast değerleri tasarım gereği daha yüksek | Yıkıcı butonlar gri dolgu yerine şeffaf zemin (3.3 → ≥4.6). Seçili sekme etiketi `label` rengi, simgesi `fg-blue`. `--secondary-label` 0.75 → 0.78. Açık modda `--link` 30,110,244 → 20,95,220 (4.09 → 5.1) |
| 4 | Hiçbir durum yalnızca renkle iletilmiyor `[HIG: color, accessibility]` | GEÇTİ | Her `text-status-*` öğesinin ya `aria-label`'ı var ya da yanında metin duruyor | — |
| 5 | Light/Thin ağırlık yok; min 10pt (masaüstü) / 11pt (mobil) `[HIG: typography]` | GEÇTİ | Görünen her metin düğümünün hesaplanan font-size ve font-weight değeri ölçüldü. `hig-lint` `font-light` sınıflarını ve gömülü fontları yakalar | — |
| 6 | %200 metinde kırpılma yok, dar ekranda yığılmış düzen çalışıyor `[HIG: typography, accessibility]` | GEÇTİ | `html { font-size: 200% }` ile 4 ekranda yatay taşma ≤ 1 px | — |
| 7 | Tab bar ≤5 sekme, tek kelime etiket, `.fill` simge, aksiyon yok `[HIG: tab-bars]` | GEÇTİ | 375 px'te 5 bağlantı var, buton yok. Etiketler: Kütüphane, Sohbet, Grafik, Ayarlar. Arama sekmesi ayrı | — |
| 8 | Sidebar varsayılan açık, ≤2 seviye, altta kritik öğe yok `[HIG: sidebars]` | GEÇTİ | 1920 px'te görünür; iç içe `ul` yok; başlıklar yalnızca "Bölümler" ve "Koleksiyonlar" | — |
| 9 | Toolbar: başlık <15 karakter, ≤3 grup, tek `.prominent` aksiyon (trailing) `[HIG: toolbars]` | GEÇTİ | 4 bölümde başlık uzunluğu, grup sayısı ve dolgu buton sayısı ölçüldü | — |
| 10 | İlerleme göstergeleri determinate, somut etiketli, sabit konumda `[HIG: progress-indicators]` | GEÇTİ | "Varlıklar çıkarılıyor · 4/5", "Grafa yazılıyor · x/y parça", "Grafta ilişkiler aranıyor". Toplam ilerleme her zaman toolbar'daki aynı yerde. Kurulum testinde Realtime ile uçtan uca izlendi | — |
| 11 | Sürükle-bırak: yalnızca geçerli hedefte vurgu, alternatif buton, geri alma `[HIG: drag-and-drop]` | GEÇTİ | PNG dosyasında vurgu yok, "Bu dosya türü desteklenmiyor" yazısı çıkar. MD dosyasında "Bırakarak yükle" görünür ve sürükleme ayrılınca kalkar. "Yükle" butonu var. 5 sn'lik "Geri Al" penceresi kurulum testinde bekleniyor | Testin kendi dragleave olayı düzeltildi |
| 12 | Hit target: masaüstü ≥20 (28 önerilen), dokunmatik ≥28 (44 önerilen) `[HIG: accessibility]` | GEÇTİ | Tüm buton, bağlantı ve girdiler ölçüldü. Önerilen değerin altındakiler test ekinde raporlanır | Arama girdileri pill yüksekliğine uzatıldı (16 → 28/44). Kontrast anahtarı 24 → 28 |
| 13 | Tüm akışlar klavyeyle tamamlanabiliyor `[HIG: accessibility]` | GEÇTİ | Klavyeyle giriş (Enter). Ctrl+1..4 ile bölüm geçişi. Graf düğümünde Tab + Enter seçer, Esc kapatır. Sohbette Enter gönderir. Kütüphane tablosunda ↑/↓/Enter | — |
| 14 | Reduced motion ve reduced transparency `[HIG: accessibility, materials]` | GEÇTİ | `reducedMotion: reduce` ile animasyon süresi < 0.001 sn; graf fizik animasyonu olmadan yerleşir. `prefers-reduced-transparency` ve `prefers-contrast` kuralları stil sayfasında mevcut. Playwright reduced-transparency'yi taklit edemediği için bu madde stil sayfası üzerinden kontrol edildi | — |
| 15 | SF Symbols logo veya uygulama ikonu olarak kullanılmamış `[HIG: sf-symbols]` | GEÇTİ | Giriş başlığında svg veya img yok; uygulama adı düz metin. Çizimler SF Symbols değil, lucide (ISC) | — |

## Denetimde bulunan diğer hatalar

- **API:** Supabase auth sunucusunun saati birkaç saniye ileride olabiliyor. Bu durumda girişten hemen sonraki ilk istek 401 alıyordu. JWT doğrulamasına 30 sn tolerans eklendi ve bir regresyon testi yazıldı (`test_accepts_token_issued_slightly_in_the_future`).
- **Dar ekranda kütüphane:** Grouped arka plan sayfanın sonuna kadar uzatıldı.

## Bilinen sınırlar

- Ekran okuyucu davranışı (sohbette cümle cümle duyuru, `aria-live` ilerleme) kodda var. VoiceOver/NVDA ile elle dinlenerek doğrulanmadı.
- Artırılmış kontrast modu Playwright ile ayrı bir proje olarak taranmadı. Bu moddaki değerler normal moddan daha yüksek kontrastlıdır.
- Testlerde OpenAI anahtarı yerine çevrimdışı test sağlayıcısı kullanıldı. Yanıt metinlerinin kalitesi bu denetimin kapsamı dışında.
