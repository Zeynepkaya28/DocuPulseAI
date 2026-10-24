# GraphRAG Eval Sonuçları

20 soru · k=3 pasaj · parça boyutu ≤220 karakter · sağlayıcı: `FakeProvider` · embedding: `fake (hashing)`

Metrik: **bağlam hatırlama** = beklenen olguların getirilen bağlamda bulunma oranı.

| Soru grubu | Yalnız vektör | GraphRAG |
|---|---|---|
| 1 adım | 1.00 | 1.00 |
| 2 adım | 0.89 | 0.94 |
| 3 adım | 0.67 | 0.67 |
| **Tümü** | **0.92** | **0.94** |

## Soru bazında

| # | Adım | Soru | Vektör | GraphRAG | Zincir | Çelişki |
|---|---|---|---|---|---|---|
| 1 | 1 | Roket X aracını hangi şirket geliştirdi? | 1.00 | 1.00 | 9 | 0 |
| 2 | 1 | Acme Uzay şirketinin genel müdürü kim? | 1.00 | 1.00 | 9 | 0 |
| 3 | 1 | Uydu Z hangi araçla fırlatıldı? | 1.00 | 1.00 | 9 | 0 |
| 4 | 1 | Uydu Z güneş panellerini kim üretti? | 1.00 | 1.00 | 9 | 0 |
| 5 | 1 | Orbit Labs kurucusu kim? | 1.00 | 1.00 | 8 | 0 |
| 6 | 1 | Turbo M motorunu hangi şirket üretti? | 1.00 | 1.00 | 7 | 0 |
| 7 | 1 | Uydu Z kamerası hangi modeli kullanır? | 1.00 | 1.00 | 9 | 0 |
| 8 | 1 | Delta Havacılık araştırma direktörü kim? | 1.00 | 1.00 | 9 | 0 |
| 9 | 2 | Uydu Z'yi fırlatan aracı hangi şirket geliştirdi? | 0.50 | 0.50 | 9 | 0 |
| 10 | 2 | Roket X'i geliştiren şirketin baş mühendisi kim? | 1.00 | 1.00 | 9 | 0 |
| 11 | 2 | Uydu Z güneş panellerini üreten şirketin merkezi hangi şehirde? | 1.00 | 1.00 | 9 | 0 |
| 12 | 2 | Roket X'in birinci kademesindeki motoru hangi şirket üretti? | 1.00 | 1.00 | 9 | 0 |
| 13 | 2 | Uydu Z verilerinin iletildiği istasyon hangi eyalette? | 1.00 | 1.00 | 9 | 0 |
| 14 | 2 | Acme Uzay genel müdürünün daha önce çalıştığı şirket hangi motoru üretti? | 0.50 | 1.00 | 9 | 0 |
| 15 | 2 | Uydu Z kamerasındaki modeli üreten firma kim? | 1.00 | 1.00 | 9 | 0 |
| 16 | 2 | Orbit Labs kurucusu daha önce hangi şirkette stajyerdi ve o şirket hangi aracı geliştirdi? | 1.00 | 1.00 | 8 | 0 |
| 17 | 3 | Uydu Z'yi fırlatan aracın motorunu üreten şirketin araştırma direktörü kim? | 0.33 | 0.33 | 9 | 0 |
| 18 | 3 | Uydu Z'yi fırlatan aracı geliştiren şirketin genel müdürü kim? | 1.00 | 1.00 | 9 | 0 |
| 19 | 2 | Helios Enerji hangi şirketle tedarik anlaşması imzaladı? | 1.00 | 1.00 | 8 | 0 |
| 20 | 1 | Acme Uzay hangi yıl kuruldu? | 1.00 | 1.00 | 9 | 0 |

Not: Fake sağlayıcı ile varlık çıkarımı büyük harfli ifadelere dayalı kaba bir yaklaşımdır ve ilişki türleri 'ilişkili' olur. Gerçek sonuçlar için `LLM_PROVIDER=openai` ve `OPENAI_API_KEY` ile yeniden çalıştırın.
