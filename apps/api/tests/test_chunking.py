from app.chunking import parse, parse_csv, parse_markdown, split_text
from app.workers import clean_extraction, extraction_prompt


def test_split_respects_max_chars():
    text = "\n\n".join(f"Paragraf {i}. " + "kelime " * 60 for i in range(20))
    pieces = split_text(text, max_chars=500)
    assert len(pieces) > 5
    assert all(len(p.content) <= 500 for p in pieces)


def test_split_long_sentence_without_boundaries():
    pieces = split_text("x" * 3000, max_chars=1000, overlap=100)
    assert all(len(p.content) <= 1000 for p in pieces)
    assert sum(len(p.content) for p in pieces) >= 3000


def test_markdown_front_matter_and_heading():
    md = "---\nauthor: Ada Lovelace\ndate: 2024-03-01\n---\n# Analitik Motor\n\nGiriş.\n\n## Bölüm\n\nMetin."
    pieces, meta = parse_markdown(md)
    assert meta.author == "Ada Lovelace"
    assert meta.published_at == "2024-03-01"
    assert meta.title == "Analitik Motor"
    assert any("Bölüm" in p.content for p in pieces)


def test_csv_rows_become_key_value_lines():
    pieces, meta = parse_csv("ad;şehir\nAyşe;İzmir\nMehmet;Ankara\n")
    assert meta.extra["columns"] == ["ad", "şehir"]
    assert "ad: Ayşe; şehir: İzmir" in pieces[0].content


def test_txt_decodes_turkish_cp1254():
    pieces, _ = parse("text/plain", "Çalışma ğüşiöç".encode("cp1254"))
    assert "Çalışma" in pieces[0].content


def test_clean_extraction_drops_invalid_evidence_and_unknown_endpoints():
    out = {
        "entities": [{"name": "Acme", "type": "organization", "aliases": ["ACME A.Ş."]},
                     {"name": "Roket X", "type": "weird", "aliases": []}],
        "relations": [
            {"source": "ACME A.Ş.", "target": "Roket X", "type": "geliştirdi", "evidence_chunk_id": "c1"},
            {"source": "Acme", "target": "Roket X", "type": "Geliştirdi", "evidence_chunk_id": "c1"},  # dup
            {"source": "Acme", "target": "Roket X", "type": "üretti", "evidence_chunk_id": "nope"},
            {"source": "Acme", "target": "Bilinmeyen", "type": "sahip", "evidence_chunk_id": "c1"},
        ],
    }
    entities, relations = clean_extraction(out, ["c1"])
    assert entities[1]["type"] == "concept"
    assert len(relations) == 1


def test_extraction_prompt_tags_chunks():
    assert extraction_prompt([{"id": "a", "content": "x"}]) == "[chunk:a]\nx"
