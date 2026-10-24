-- Supabase Cron → Vercel worker endpoints (Faz B4 trigger).
-- Secrets live in Vault, set once per environment:
--   select vault.create_secret('https://<api-domain>', 'api_url');
--   select vault.create_secret('<WORKER_SECRET>', 'worker_secret');
-- Without them (local dev) invoke_worker is a no-op; use `npm run worker:tick` instead.

create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.invoke_worker(p_queue text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_secret text;
  v_len bigint;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'api_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'worker_secret';
  if v_url is null or v_secret is null then
    return;
  end if;

  -- Skip the HTTP call when there is nothing to do (saves function invocations).
  select queue_length into v_len from pgmq.metrics(p_queue);
  if coalesce(v_len, 0) = 0 then
    return;
  end if;

  perform net.http_post(
    url := v_url || '/internal/workers/' || p_queue,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Worker-Secret', v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
end;
$$;

revoke execute on function public.invoke_worker(text) from public, anon, authenticated;

select cron.schedule('worker-document-ingest', '* * * * *', $$select public.invoke_worker('document_ingest')$$);
select cron.schedule('worker-chunk-embed', '* * * * *', $$select public.invoke_worker('chunk_embed')$$);
select cron.schedule('worker-chunk-extract', '* * * * *', $$select public.invoke_worker('chunk_extract')$$);
select cron.schedule('worker-graph-write', '* * * * *', $$select public.invoke_worker('graph_write')$$);
