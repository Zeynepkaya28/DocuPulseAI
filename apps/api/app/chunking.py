"""Parsing and chunking for PDF, Markdown, CSV and TXT."""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field

MAX_CHARS = 1200
OVERLAP = 150
PAGES_PER_PART = 25  # big PDFs are split into several document_ingest messages


@dataclass
class Piece:
    content: str
    page: int | None = None


@dataclass
class Meta:
    author: str | None = None
    published_at: str | None = None  # ISO date
    title: str | None = None
    extra: dict = field(default_factory=dict)


def split_text(text: str, page: int | None = None, max_chars: int = MAX_CHARS, overlap: int = OVERLAP) -> list[Piece]:
    """Paragraph-first packing; long paragraphs are cut on sentence boundaries with overlap."""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    pieces: list[Piece] = []
    buf = ""
    for p in paras:
        if len(p) > max_chars:
            if buf:
                pieces.append(Piece(buf, page))
                buf = ""
            sentences = re.split(r"(?<=[.!?…])\s+", p)
            cur = ""
            for s in sentences:
                while len(s) > max_chars:  # no sentence boundary at all
                    pieces.append(Piece(s[:max_chars], page))
                    s = s[max_chars - overlap:]
                if len(cur) + len(s) + 1 > max_chars and cur:
                    pieces.append(Piece(cur, page))
                    cur = cur[-overlap:] + " " + s
                else:
                    cur = f"{cur} {s}".strip()
            if cur:
                buf = cur
            continue
        if len(buf) + len(p) + 2 > max_chars and buf:
            pieces.append(Piece(buf, page))
            buf = p
        else:
            buf = f"{buf}\n\n{p}" if buf else p
    if buf:
        pieces.append(Piece(buf, page))
    return pieces


def pdf_page_count(data: bytes) -> int:
    from pypdf import PdfReader

    return len(PdfReader(io.BytesIO(data)).pages)


def parse_pdf(data: bytes, page_from: int = 1, page_to: int | None = None) -> tuple[list[Piece], Meta]:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    meta = Meta()
    info = reader.metadata or {}
    meta.author = (info.get("/Author") or None) and str(info.get("/Author")).strip() or None
    meta.title = (info.get("/Title") or None) and str(info.get("/Title")).strip() or None
    created = str(info.get("/CreationDate") or "")
    m = re.match(r"D:(\d{4})(\d{2})(\d{2})", created)
    if m:
        meta.published_at = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    last = min(page_to or len(reader.pages), len(reader.pages))
    pieces: list[Piece] = []
    for i in range(page_from - 1, last):
        text = reader.pages[i].extract_text() or ""
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"-\n(\w)", r"\1", text)  # de-hyphenate line breaks
        pieces.extend(split_text(text, page=i + 1))
    return pieces, meta


_FRONT = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)


def parse_markdown(text: str) -> tuple[list[Piece], Meta]:
    meta = Meta()
    fm = _FRONT.match(text)
    if fm:
        for line in fm.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                k, v = k.strip().lower(), v.strip().strip("\"'")
                if k == "author":
                    meta.author = v
                elif k in ("date", "published", "published_at"):
                    meta.published_at = v[:10]
                elif k == "title":
                    meta.title = v
        text = text[fm.end():]
    h1 = re.search(r"^#\s+(.+)$", text, re.M)
    if h1 and not meta.title:
        meta.title = h1.group(1).strip()
    # Keep headings with their sections: split on headings first, then pack.
    sections = re.split(r"(?m)^(?=#{1,6}\s)", text)
    pieces: list[Piece] = []
    for s in sections:
        pieces.extend(split_text(s))
    return pieces, meta


def parse_csv(text: str, rows_per_chunk: int = 20) -> tuple[list[Piece], Meta]:
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    rows = list(csv.reader(io.StringIO(text), dialect))
    if not rows:
        return [], Meta()
    header, body = rows[0], rows[1:]
    pieces = []
    for i in range(0, len(body), rows_per_chunk):
        block = body[i : i + rows_per_chunk]
        lines = ["; ".join(f"{h}: {v}" for h, v in zip(header, r, strict=False) if v) for r in block]
        pieces.append(Piece("\n".join(lines)))
    return pieces, Meta(extra={"columns": header})


def decode(data: bytes) -> str:
    for enc in ("utf-8-sig", "utf-8", "cp1254", "latin-1"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode("utf-8", errors="replace")


def parse(mime: str, data: bytes, page_from: int = 1, page_to: int | None = None) -> tuple[list[Piece], Meta]:
    if mime == "application/pdf":
        return parse_pdf(data, page_from, page_to)
    text = decode(data)
    if mime == "text/markdown":
        return parse_markdown(text)
    if mime == "text/csv":
        return parse_csv(text)
    return split_text(text), Meta()
