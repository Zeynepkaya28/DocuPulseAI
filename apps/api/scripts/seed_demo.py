"""Local demo data for alice@docupulse.test: uploads sample Markdown docs and marks them uploaded.
Run from apps/api:  .venv/Scripts/python -m scripts.seed_demo   then  npm run worker:tick
"""
import uuid

from app import db, storage

ALICE = "11111111-1111-1111-1111-111111111111"
RESEARCH = "aaaaaaaa-0000-0000-0000-000000000001"

DOCS = [
    ("Yıllık_Rapor_2024_Finansal_Sonuçlar_v3.md", None,
     "# Yıllık Rapor\n\nAcme Uzay şirketi Roket X aracını geliştirdi. Roket X ilk uçuşunu Kennedy Üssü üzerinden yaptı.\n\n"
     "Ayşe Yılmaz Acme Uzay şirketinin baş mühendisidir. Acme Uzay kuruluş tarihi 2009 olarak açıklandı."),
    ("Orbit_Labs_Notlar.md", RESEARCH,
     "---\nauthor: Mehmet Demir\ndate: 2023-05-02\n---\n# Orbit Labs\n\nOrbit Labs ekibi Uydu Z projesini başlattı. "
     "Ayşe Yılmaz Orbit Labs ekibinde çalıştı. Uydu Z Roket X ile fırlatıldı.\n\nAcme Uzay kuruluş tarihi 2011 olarak geçer."),
    ("Uydu_Z_Teknik.md", RESEARCH,
     "# Uydu Z Teknik Özet\n\nUydu Z güneş panelleri Helios Enerji tarafından üretildi. Helios Enerji merkezi İzmir şehrindedir.\n\n"
     "Uydu Z verileri Kennedy Üssü istasyonuna iletilir."),
]


def main() -> None:
    for name, collection, text in DOCS:
        doc_id = str(uuid.uuid4())
        path = f"{ALICE}/{doc_id}/{name}"
        storage.client().post(
            f"/object/documents/{path}", content=text.encode(), headers={"Content-Type": "text/markdown"}
        ).raise_for_status()
        db.execute(
            "insert into public.documents (id, owner, collection_id, title, mime, storage_path, status) "
            "values (%s, %s, %s, %s, 'text/markdown', %s, 'pending')",
            (doc_id, ALICE, collection, name.rsplit(".", 1)[0], path),
        )
        db.execute("update public.documents set status = 'uploaded' where id = %s", (doc_id,))
        print("queued", name)


if __name__ == "__main__":
    main()
