# DocuPulse AI

Dokümanlardan (PDF, Markdown, CSV, TXT) bilgi grafiği çıkaran ve kaynak gösteren yanıtlar üreten GraphRAG uygulaması.

| Klasör | İçerik |
|---|---|
| `apps/web` | Next.js + Tailwind arayüzü (Apple HIG tabanlı tasarım sistemi) — Vercel projesi #1 |
| `apps/api` | FastAPI — Vercel Python projesi #2 |
| `supabase/` | Migration'lar, RLS, Storage, Queues (pgmq), Cron |
| `packages/contracts` | API/olay şemaları: tek JSON kaynağından TS + Pydantic üretilir |
| `docs/` | Tasarım sistemi, mimari, canlıya alma, HIG denetimi |

## Yerel geliştirme

Gerekenler: Node 20+, Python 3.12, Docker.

```bash
npm install
python -m venv apps/api/.venv
apps/api/.venv/Scripts/pip install -r apps/api/requirements-dev.txt   # macOS/Linux: .venv/bin/pip
cp .env.example .env              # değerleri `npx supabase status` çıktısından doldur
cp .env.example apps/web/.env.local
make dev                          # supabase start + neo4j + web (3000) + api (8000)
```

`make` yoksa: `npx supabase start`, `docker compose up -d neo4j`, `npm run dev`.

Yerelde pg_cron, Vercel'deki worker'ları çağıramaz. Kuyrukları elle boşaltmak için `npm run worker:tick` kullan.

Şema değişince `npm run gen` çalıştır. CI, üretilen dosyalar eskiyse hata verir.

Opsiyonel: `docker compose --profile showcase up -d` komutu orijinal mimarideki Kafka ve Qdrant'ı yalnızca demo için başlatır. Canlı ortam bunlara bağlı değildir.

## Belgeler

- [Tasarım sistemi](docs/design-system.md): token'lar ve HIG kaynakları
- [Canlıya alma](docs/deploy.md): Vercel + Supabase + Neo4j AuraDB adımları ve doğrulama listesi
- [HIG denetimi](docs/hig-audit.md): 15 maddelik kontrol listesi ve ekran görüntüleri
- [Eval sonuçları](docs/eval-results.md): yalnız vektör ile GraphRAG karşılaştırması

## Testler

```bash
apps/api/.venv/Scripts/python -m pytest -q apps/api   # API + entegrasyon (yerel stack açıksa)
npx supabase test db                                  # RLS (pgTAP)
node scripts/hig-lint.mjs                             # statik HIG kontrolleri
npm run e2e -w apps/web                               # Playwright HIG denetimi (375/1920 px, açık/koyu)
```
