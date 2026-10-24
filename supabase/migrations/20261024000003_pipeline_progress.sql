-- Pipeline progress derived from data, so retried (duplicate) messages never double-count. (Faz B4)

alter table public.chunks add column if not exists graph_at timestamptz;
alter table public.jobs add column if not exists meta jsonb not null default '{}'::jsonb;

-- Mark one ingest part (page range) done; parts are idempotent (stored as a set).
create or replace function public.job_part_done(p_document uuid, p_part int) returns void
language sql security definer set search_path = '' as $$
  update public.jobs
     set meta = jsonb_set(meta, '{parts_done}',
                (select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
                   from jsonb_array_elements(coalesce(meta -> 'parts_done', '[]'::jsonb) || to_jsonb(p_part)) as x))
   where document_id = p_document;
$$;

-- Recompute stage/progress/total from chunk columns. Each stage is an equal fifth in the UI.
-- 1 Yükleniyor · 2 Parçalara bölünüyor · 3 Embedding · 4 Varlıklar çıkarılıyor · 5 Grafa yazılıyor
create or replace function public.refresh_job(p_document uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  j public.jobs;
  d_status text;
  parts_total int;
  parts_done int;
  n_total int;
  n_emb int;
  n_ext int;
  n_graph int;
  v_stage int;
  v_progress int;
  v_total int;
  v_status text := 'running';
  names text[] := array['Yükleniyor', 'Parçalara bölünüyor', 'Embedding', 'Varlıklar çıkarılıyor', 'Grafa yazılıyor'];
begin
  select * into j from public.jobs where document_id = p_document for update;
  select status into d_status from public.documents where id = p_document;
  if j.id is null or d_status is null or d_status in ('canceled', 'failed') or j.status in ('canceled', 'failed') then
    return coalesce(j.status, 'missing');
  end if;

  parts_total := nullif(j.meta ->> 'parts_total', '')::int;
  parts_done := jsonb_array_length(coalesce(j.meta -> 'parts_done', '[]'::jsonb));
  select count(*), count(embedding), count(extracted_at), count(graph_at)
    into n_total, n_emb, n_ext, n_graph
    from public.chunks where document_id = p_document;

  if parts_total is null or parts_done < parts_total then
    v_stage := 2; v_progress := parts_done; v_total := parts_total;
  elsif n_emb < n_total then
    v_stage := 3; v_progress := n_emb; v_total := n_total;
  elsif n_ext < n_total then
    v_stage := 4; v_progress := n_ext; v_total := n_total;
  elsif n_graph < n_total then
    v_stage := 5; v_progress := n_graph; v_total := n_total;
  else
    v_stage := 5; v_progress := n_total; v_total := n_total; v_status := 'done';
  end if;

  update public.jobs
     set stage = v_stage, stage_name = names[v_stage], progress = v_progress, total = v_total,
         status = v_status, error = null
   where id = j.id
     and (stage, progress, coalesce(total, -1), status) is distinct from (v_stage, v_progress, coalesce(v_total, -1), v_status);

  update public.documents
     set status = case when v_status = 'done' then 'ready' else 'processing' end
   where id = p_document and status <> case when v_status = 'done' then 'ready' else 'processing' end;

  return v_status;
end;
$$;

create or replace function public.fail_job(p_document uuid, p_error text) returns void
language sql security definer set search_path = '' as $$
  update public.jobs set status = 'failed', error = p_error where document_id = p_document;
  update public.documents set status = 'failed' where id = p_document and status <> 'canceled';
$$;

revoke execute on function public.refresh_job(uuid), public.fail_job(uuid, text), public.job_part_done(uuid, int)
  from public, anon, authenticated;
