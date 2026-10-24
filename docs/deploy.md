# Canlıya Alma — Vercel + Supabase + Neo4j AuraDB (Faz B6)

Mimari: `apps/web` (Next.js) ve `apps/api` (FastAPI) aynı repodan **iki ayrı Vercel projesi** olarak yayınlanır. Veritabanı, kimlik doğrulama, depolama, Realtime, kuyruk (pgmq) ve zamanlayıcı (pg_cron) Supabase'den gelir. Graf veritabanı Neo4j AuraDB'dir.

```
Tarayıcı ──(imzalı URL / TUS)──▶ Supabase Storage
   │                                   │
   │ JWT                               ▼ trigger → pgmq
   ▼                             Supabase Postgres ◀── pg_cron (her dakika)
Vercel web ──▶ Vercel api ◀────────────────────────── pg_net POST /internal/workers/{kuyruk}
                   │
                   └──▶ Neo4j AuraDB, OpenAI
```

## 1. Supabase

1. [supabase.com](https://supabase.com) → **New project**. Bölge: **Central EU (Frankfurt)**. Bu, Vercel'deki `fra1` bölgesine yakındır.
2. Yerelde projeyi bağla ve migration'ları uygula:
   ```bash
   npx supabase login
   npx supabase link --project-ref <PROJECT_REF>
   npx supabase db push
   ```
   Bu komut tabloları, RLS'i, `documents` bucket'ını, Realtime yayınını, pgmq kuyruklarını, tetikleyiciyi, `match_chunks` fonksiyonunu ve cron işlerini oluşturur. `seed.sql` canlıya **uygulanmaz**.
3. **Vault sırları:** `supabase/production-secrets.sql.example` dosyasını kopyala, değerleri doldur ve SQL Editor'da çalıştır. Doldurulmuş kopyayı commit'leme. Bu adım atlanırsa cron çalışır ama worker'ları çağırmaz.
4. **Auth → URL Configuration:**
   - Site URL: `https://<web-domain>` (production)
   - Redirect URLs: `https://<web-domain>/**`, `https://docupulse-web-*-<takım>.vercel.app/**` (preview)
5. **Doğrula:** Dashboard → Storage → `documents` bucket'ı **private** olmalı. Integrations → Queues: 4 kuyruk + 4 `_dlq`. Integrations → Cron: 4 iş.

## 2. Neo4j AuraDB

[console.neo4j.io](https://console.neo4j.io) → **AuraDB Free/Professional** → bölge olarak Frankfurt'a yakın bir yer seç. Bağlantı URI'si (`neo4j+s://…`), kullanıcı adı ve parolayı al. Kısıtlar (constraints) ilk `graph_write` çalışmasında otomatik oluşur.

## 3. Vercel

Aynı GitHub reposundan iki proje oluştur:

| Proje | Root Directory | Framework | Bölge |
|---|---|---|---|
| `docupulse-web` | `apps/web` | Next.js | `fra1` (`apps/web/vercel.json`) |
| `docupulse-api` | `apps/api` | Other (Python) | `fra1`, `maxDuration: 300` (`apps/api/vercel.json`) |

İki projede de **"Include source files outside of the Root Directory"** açık kalmalı (varsayılan). Web, `packages/contracts` paketini kullanır.

Supabase entegrasyonunu Vercel Marketplace'ten bağlayabilirsin (Supabase değişkenleri otomatik gelir) ya da değişkenleri elle ekleyebilirsin. Production, Preview ve Development için **ayrı değerler** kullan.

### `docupulse-web` ortam değişkenleri

| Değişken | Değer |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL'i |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon (publishable) anahtar |
| `NEXT_PUBLIC_API_URL` | `https://<docupulse-api domaini>` |

### `docupulse-api` ortam değişkenleri

Bunlar **sunucuya özeldir**. Hiçbiri `NEXT_PUBLIC_` önekiyle tanımlanmaz.

| Değişken | Değer |
|---|---|
| `SUPABASE_URL` | Supabase proje URL'i |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role anahtarı |
| `SUPABASE_JWT_SECRET` | JWT secret (eski HS256 projeler). Yeni projeler JWKS ile doğrulanır |
| `SUPABASE_DB_URL` | **Pooler** URL'i, transaction modu, port `6543` |
| `NEO4J_URI` / `NEO4J_USER` / `NEO4J_PASSWORD` | AuraDB bilgileri |
| `LLM_PROVIDER` | `openai` |
| `OPENAI_API_KEY` | OpenAI anahtarı |
| `WORKER_SECRET` | Vault'taki `worker_secret` ile aynı uzun rastgele değer |
| `ALLOWED_ORIGINS` | `https://<web-domain>` |
| `ALLOWED_ORIGIN_REGEX` | `^https://docupulse-web-[a-z0-9-]+\.vercel\.app$` (preview) |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | İsteğe bağlı (Marketplace → Upstash). Yoksa Postgres sayacı kullanılır |

### Preview ortamı

Preview deploy'ları **production veritabanına dokunmamalı**. İki yol var:

- **Supabase Branching:** Proje → Branches → GitHub entegrasyonu. Her PR için ayrı bir veritabanı açılır. Preview ortam değişkenlerini Vercel entegrasyonu otomatik doldurur.
- **Ayrı bir "staging" Supabase projesi:** Vercel'de Preview ortamının değişkenlerini bu projeye yönlendir ve 1–3. adımları orada da uygula.

Neo4j için de ayrı bir AuraDB örneği (ya da en azından ayrı bir veritabanı) kullan.

## 4. CI/CD (GitHub Actions)

- `.github/workflows/ci.yml` her PR'da çalışır. Web için lint, typecheck, build ve contracts senkron kontrolü yapılır. API için ruff ve pytest çalışır. E2E işi yerel Supabase ile Neo4j'yi başlatır, pgTAP RLS testlerini, pipeline entegrasyon testlerini ve Playwright HIG kontrollerini (Faz A7) çalıştırır.
- `.github/workflows/deploy.yml`: `main`'e migration değişikliği merge edildiğinde production'da `supabase db push` çalışır. Gereken repo sırları: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`. Ayrıca **production** environment için onaylayıcı tanımla.
- Vercel, Git entegrasyonuyla `main`'den production'a, PR'lardan preview'a kendisi deploy eder.

## 5. Canlı doğrulama listesi

- [ ] **20 MB PDF:** Kütüphane'den yükle. Tarayıcının Network sekmesinde dosya isteği `*.supabase.co/storage/v1/upload/resumable` adresine (TUS) gitmeli, Vercel'e gitmemeli. 413 hatası çıkmamalı.
- [ ] **5 aşama Realtime'da akıyor:** Satırda sırasıyla "Yükleniyor · 1/5" → "Parçalara bölünüyor · 2/5" → "Embedding · 3/5" → "Varlıklar çıkarılıyor · 4/5" → "Grafa yazılıyor · 5/5" → "Hazır" görünmeli. Toolbar'daki iş göstergesi de güncellenmeli.
- [ ] **Graf oluştu:** Bilgi Grafiği'nde düğümler ve ilişkiler görünmeli. Doküman detayındaki "Grafta Göster" yalnızca o dokümanın alt grafını açmalı.
- [ ] **Sohbet:** Yanıtın altında "Pasajlar" (doküman + sayfa) ve "İlişki zinciri" çipleri olmalı. Zincire tıklayınca grafta ilgili düğüm seçilmeli.
- [ ] **RLS:** İkinci bir kullanıcıyla giriş yap. Birinci kullanıcının dokümanları kütüphanede, aramada, sohbet kaynaklarında ve grafta görünmemeli. Koleksiyon paylaşıldığında (`collection_members`) görünmeli.
- [ ] **Loglar:** Vercel → api → Logs'ta `FUNCTION_INVOCATION_TIMEOUT`, 413 ya da 5xx olmamalı. Supabase → Logs'ta RLS `42501` hatası olmamalı. Kuyrukların `_dlq` uzunluğu 0 olmalı:
  ```sql
  select queue_name, queue_length from pgmq.metrics_all();
  select jobname, status, return_message from cron.job_run_details order by start_time desc limit 20;
  ```

## Sınırlar ve notlar

- Vercel Hobby'de fonksiyonlar en fazla 300 sn sürer. Worker'lar her çağrıda 240 sn'lik bütçeyle küçük işler yapar ve süre bu sınıra bağlı değildir. Pro planda `maxDuration` 800'e çıkarılabilir.
- Dosyalar API'den geçmez. 6 MB üstü dosyalar 6 MB parçalarla TUS üzerinden yüklenir.
- Ollama Vercel'de çalışmaz. Yalnızca yerel geliştirmede `LLM_PROVIDER=ollama` kullan.
- Embedding kolonu `vector(1536)`'dır. 1536'dan farklı boyutlu modeller sıfırla doldurulur. Modeli değiştirirsen mevcut embedding'leri yeniden üret.
