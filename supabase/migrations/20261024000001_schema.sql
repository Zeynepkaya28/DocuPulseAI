-- DocuPulse AI — core schema (Faz B2)
-- Tables, RLS, storage bucket, realtime publication, queues, ingest trigger, hybrid search.

create extension if not exists vector with schema extensions;
create extension if not exists pgmq;

-- ─────────────────────────── Profiles & roles ───────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'editor' check (role in ('admin', 'editor', 'viewer')),
  last_sign_in_at timestamptz,
  created_at timestamptz not null default now()
);

-- Role of the calling user. SECURITY DEFINER so policies can read it without recursion.
create or replace function public.app_role() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select role from public.profiles where id = auth.uid()), 'viewer');
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.app_role() = 'admin';
$$;

-- New auth user → profile row. The very first user becomes admin.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    case when exists (select 1 from public.profiles) then 'editor' else 'admin' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────── Collections & sharing ───────────────────────────
create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

create table public.collection_members (
  collection_id uuid not null references public.collections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  primary key (collection_id, user_id)
);

create or replace function public.can_read_collection(p_collection uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.collections c
    where c.id = p_collection
      and (c.owner = p_user
           or exists (select 1 from public.collection_members m where m.collection_id = c.id and m.user_id = p_user))
  );
$$;

-- ─────────────────────────── Documents ───────────────────────────
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  collection_id uuid references public.collections (id) on delete set null,
  title text not null,
  author text,
  published_at date,
  mime text not null,
  size_bytes bigint,
  storage_path text,
  status text not null default 'pending'
    check (status in ('pending', 'uploaded', 'processing', 'ready', 'failed', 'canceled')),
  summary text,
  entity_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index documents_owner_idx on public.documents (owner, created_at desc);
create index documents_collection_idx on public.documents (collection_id);

-- Visibility used by RLS and by service-side queries (p_user passed explicitly).
create or replace function public.can_read_document(p_owner uuid, p_collection uuid, p_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select p_owner = p_user or (p_collection is not null and public.can_read_collection(p_collection, p_user));
$$;

-- ─────────────────────────── Jobs (pipeline status → Realtime) ───────────────────────────
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents (id) on delete cascade,
  owner uuid not null references public.profiles (id) on delete cascade,
  stage int not null default 1 check (stage between 1 and 5),
  stage_name text not null default 'Yükleniyor',
  progress int not null default 0,
  total int,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed', 'canceled')),
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_owner_idx on public.jobs (owner, updated_at desc);

-- ─────────────────────────── Chunks (pgvector + full-text) ───────────────────────────
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  ord int not null,
  page int,
  content text not null,
  embedding extensions.vector(1536),
  fts tsvector generated always as (to_tsvector('simple', content)) stored,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (document_id, ord) -- idempotent re-ingest
);
create index chunks_document_idx on public.chunks (document_id);
create index chunks_embedding_hnsw on public.chunks using hnsw (embedding extensions.vector_cosine_ops);
create index chunks_fts_gin on public.chunks using gin (fts);

-- ─────────────────────────── Chat ───────────────────────────
create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text,
  collection_id uuid references public.collections (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  owner uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index chat_messages_session_idx on public.chat_messages (session_id, created_at);

-- ─────────────────────────── Rate limit fallback (no Upstash) ───────────────────────────
create table public.rate_limits (
  user_id uuid not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (user_id, window_start)
);

create or replace function public.hit_rate_limit(p_user uuid, p_limit int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  w timestamptz := date_trunc('minute', now());
  c int;
begin
  insert into public.rate_limits as r (user_id, window_start, count) values (p_user, w, 1)
  on conflict (user_id, window_start) do update set count = r.count + 1
  returning r.count into c;
  delete from public.rate_limits where window_start < now() - interval '10 minutes';
  return c <= p_limit;
end;
$$;

-- updated_at
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end; $$;
create trigger documents_touch before update on public.documents for each row execute function public.touch_updated_at();
create trigger jobs_touch before update on public.jobs for each row execute function public.touch_updated_at();

-- ─────────────────────────── Row Level Security ───────────────────────────
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.collection_members enable row level security;
alter table public.documents enable row level security;
alter table public.jobs enable row level security;
alter table public.chunks enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.rate_limits enable row level security; -- no policies: service role only

create policy "profiles: read own, admin reads all" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy "profiles: admin updates roles" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "collections: read owned or shared" on public.collections for select to authenticated
  using (public.can_read_collection(id));
create policy "collections: writers insert" on public.collections for insert to authenticated
  with check (owner = (select auth.uid()) and public.app_role() <> 'viewer');
create policy "collections: owner updates" on public.collections for update to authenticated
  using (owner = (select auth.uid()) and public.app_role() <> 'viewer');
create policy "collections: owner deletes" on public.collections for delete to authenticated
  using (owner = (select auth.uid()) and public.app_role() <> 'viewer');

create policy "members: visible to collection readers" on public.collection_members for select to authenticated
  using (public.can_read_collection(collection_id));
create policy "members: owner manages" on public.collection_members for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.owner = (select auth.uid())))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.owner = (select auth.uid())));

-- Users see their own documents and those in collections shared with them. Viewers cannot write.
create policy "documents: read own or shared" on public.documents for select to authenticated
  using (public.can_read_document(owner, collection_id));
create policy "documents: writers insert own" on public.documents for insert to authenticated
  with check (owner = (select auth.uid()) and public.app_role() <> 'viewer');
create policy "documents: writers update own" on public.documents for update to authenticated
  using (owner = (select auth.uid()) and public.app_role() <> 'viewer');
create policy "documents: writers delete own" on public.documents for delete to authenticated
  using (owner = (select auth.uid()) and public.app_role() <> 'viewer');

-- Clients only READ their own jobs (Realtime honours this); workers write with the service role.
create policy "jobs: read own" on public.jobs for select to authenticated
  using (owner = (select auth.uid()));

create policy "chunks: readable with document" on public.chunks for select to authenticated
  using (exists (select 1 from public.documents d where d.id = document_id));

create policy "chat_sessions: own" on public.chat_sessions for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "chat_messages: own" on public.chat_messages for all to authenticated
  using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- ─────────────────────────── Storage ───────────────────────────
-- Private bucket. Path: {user_id}/{document_id}/{file}. Only the owner reads/writes.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

create policy "documents bucket: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "documents bucket: writer uploads" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text
              and public.app_role() <> 'viewer');
create policy "documents bucket: writer updates" on storage.objects for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text
         and public.app_role() <> 'viewer');
create policy "documents bucket: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ─────────────────────────── Realtime ───────────────────────────
alter publication supabase_realtime add table public.jobs;
alter publication supabase_realtime add table public.documents;

-- ─────────────────────────── Queues (pgmq) ───────────────────────────
select pgmq.create('document_ingest');
select pgmq.create('chunk_embed');
select pgmq.create('chunk_extract');
select pgmq.create('graph_write');
select pgmq.create('document_ingest_dlq');
select pgmq.create('chunk_embed_dlq');
select pgmq.create('chunk_extract_dlq');
select pgmq.create('graph_write_dlq');

-- documents.status → 'uploaded' ⇒ job row + DocumentUploadedEvent on document_ingest.
create or replace function public.enqueue_document_ingest() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'uploaded' and old.status is distinct from 'uploaded' then
    insert into public.jobs (document_id, owner, stage, stage_name, progress, total, status, error)
    values (new.id, new.owner, 1, 'Yükleniyor', 1, 1, 'queued', null)
    on conflict (document_id) do update
      set stage = 1, stage_name = 'Yükleniyor', progress = 1, total = 1, status = 'queued', error = null;

    perform pgmq.send(
      'document_ingest',
      jsonb_build_object(
        'document_id', new.id,
        'owner_id', new.owner,
        'storage_path', new.storage_path,
        'mime', new.mime
      )
    );
  end if;
  return new;
end;
$$;

create trigger documents_uploaded
  after update of status on public.documents
  for each row execute function public.enqueue_document_ingest();

-- ─────────────────────────── Hybrid search (dense + full-text, RRF) ───────────────────────────
create or replace function public.match_chunks(
  query_embedding extensions.vector(1536),
  query_text text,
  k int default 8,
  p_user uuid default auth.uid(),
  filter_collection uuid default null,
  rrf_k int default 60
)
returns table (chunk_id uuid, document_id uuid, document_title text, page int, content text, score double precision)
language sql stable set search_path = public, extensions as $$
  with visible as (
    select d.id, d.title
    from public.documents d
    where public.can_read_document(d.owner, d.collection_id, p_user)
      and (filter_collection is null or d.collection_id = filter_collection)
      and d.status in ('processing', 'ready')
  ),
  dense as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rnk
    from public.chunks c join visible v on v.id = c.document_id
    where c.embedding is not null
    order by c.embedding <=> query_embedding
    limit k * 4
  ),
  sparse as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, q) desc) as rnk
    from public.chunks c
    join visible v on v.id = c.document_id,
    websearch_to_tsquery('simple', query_text) q
    where c.fts @@ q
    order by ts_rank_cd(c.fts, q) desc
    limit k * 4
  ),
  fused as (
    select coalesce(dense.id, sparse.id) as id,
           coalesce(1.0 / (rrf_k + dense.rnk), 0) + coalesce(1.0 / (rrf_k + sparse.rnk), 0) as score
    from dense full outer join sparse on dense.id = sparse.id
  )
  select c.id, c.document_id, v.title, c.page, c.content, f.score::double precision
  from fused f
  join public.chunks c on c.id = f.id
  join visible v on v.id = c.document_id
  order by f.score desc
  limit k;
$$;
