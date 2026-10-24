# DocuPulse AI — Tasarım Sistemi (Faz A0)

Kaynak: Apple Human Interface Guidelines. `[HIG: sayfa]` = `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<sayfa>.json`

Ham renk değerleri yalnızca [`apps/web/styles/tokens.css`](../apps/web/styles/tokens.css) içinde durur. Bileşenler Tailwind üzerinden yalnızca semantik token kullanır.

## Token → HIG kaynağı

| Token / kural | Değer | Kaynak |
|---|---|---|
| `--font-sans` | -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui | HIG: typography (sistem fontu gömülmez) |
| `--font-mono` | ui-monospace, "SF Mono", Menlo | HIG: typography |
| `--t-*` (dar ekran, varsayılan) | iOS "Large" tablosu (body 17/22 …) | HIG: typography |
| `--t-*` (≥768px, regular) | macOS tablosu (body 13/16 …) | HIG: typography, layout (size class) |
| `--w-emphasized` | 600 (iOS) / 700 (macOS) | HIG: typography "Emphasized" |
| Font ağırlıkları | yalnızca 400/500/600/700 | HIG: typography |
| Min. boyut | 10pt masaüstü, 11pt mobil | HIG: typography, accessibility |
| rem birimleri | %200 metin büyütme | HIG: accessibility |
| `--c-{red…brown,gray}` | light / dark / hc-light / hc-dark | HIG: color |
| `prefers-contrast: more`, `[data-contrast]` | artırılmış kontrast | HIG: color, accessibility |
| `prefers-color-scheme`, `[data-theme]` | light/dark, iki varyant da tanımlı | HIG: color |
| `--label`, `--secondary-label` … `--tertiary-system-grouped-background` | dinamik sistem renkleri | HIG: color "Dynamic system colors" |
| `--accent` = blue | tint rengi | HIG: color "Tint and accent" |
| `--status-processing/done/warning/error` | blue / green / orange / red | HIG: color (bir renk = bir anlam) |
| `--fg-*` | ikon/metin için koyulaştırılmış varyant | HIG: accessibility (kontrast) |
| `.glass` (regular), `.glass-clear`, `--glass-dim` 35% | kontrol katmanı | HIG: materials |
| `.material-{ultrathin,thin,regular,thick}` | içerik katmanı | HIG: materials |
| `.scroll-edge-top` | kaydırma kenarı efekti | HIG: layout, toolbars |
| `prefers-reduced-transparency` | blur kapalı, opak arka plan | HIG: materials, accessibility |
| `--hit` 28px / `--hit-min` 20px; dokunmatik 44 / 28 | tıklama alanı | HIG: accessibility |
| `--space-bezeled` 12px, `--space-borderless` 24px | kontrol çevresi boşluk | HIG: accessibility |
| `:focus-visible` halkası | klavye ile kullanım | HIG: accessibility |
| `prefers-reduced-motion` | hareket → fade | HIG: accessibility |
| `--readable-width` 680px | okunabilir genişlik | HIG: layout |

## HIG'den bilinçli sapmalar (kontrast için)

HIG değerleri WCAG 4.5:1 sınırını her yerde sağlamıyor. Faz A7 denetimini geçmek için:

1. **`--secondary-label` alfa değeri 0.6 → 0.75** (light). Footnote boyutunda grouped arka planda 4.5:1 sağlanır.
2. **`--accent-fill`**: Beyaz yazılı dolgu butonlarda düz sistem mavisi 3.5:1 veriyor. Bu yüzden light'ta hc-light mavisi (30,110,244 → 4.6:1), dark'ta 10,100,220 kullanılır. Odak halkası ve vurgu için `--accent` aynen kalır.
3. **`--fg-*`**: Light modda yeşil/turuncu ikonlar beyaz zeminde 3:1'in altında kalıyor. Bu yüzden ikon ve metin için hc-light değerleri kullanılır. Dark modda sistem değerleri yeterli.

## Bileşenler

| Bileşen | Not |
|---|---|
| `Icon` | SF Symbol **adı** alır, açık lisanslı (lucide, ISC) benzer glif çizer. `.fill`, `.slash`, `.circle.fill`, `weight`, `scale`, `rendering`, `variableValue` destekler. HIG: sf-symbols |
| `Text` | HIG metin stilleri, `emphasized`, semantik renk, `MiddleTruncate`. HIG: typography, lists-and-tables |
| `Button` | `prominent` (tek birincil aksiyon), `bordered`, `plain`, `destructive`. Min. hit target. HIG: toolbars, accessibility |
| `Glass` | Yalnızca kontrol katmanı. `regular` / `clear` + `dim`. HIG: materials |

## SF Symbols lisansı

Semboller logo veya uygulama ikonu olarak kullanılmaz `[HIG: sf-symbols]`. SF Symbols lisansı çizimleri Apple platformlarındaki uygulamalarla sınırlar. Bu yüzden halka açık web ürününde yalnızca semboller **adlarıyla** referans alınır, çizim lucide'dan gelir. Eşleme tablosu `components/ui/Icon.tsx` içinde.

Görsel QA sayfası: `/design`.
