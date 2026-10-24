-- Fuzzy title search for the live search field (Faz A3).
create extension if not exists pg_trgm with schema extensions;
create index if not exists documents_title_trgm on public.documents using gin (lower(title) extensions.gin_trgm_ops);
