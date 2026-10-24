-- pgTAP RLS tests. Run: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

-- Fixtures (as postgres, bypassing RLS)
insert into public.documents (id, owner, title, mime, status)
values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice doc', 'text/plain', 'ready');
insert into public.jobs (document_id, owner) values ('d0000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');

-- Act as Bob
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);

select is((select count(*) from public.documents)::int, 0, 'Bob cannot see Alice''s documents');
select is((select count(*) from public.jobs)::int, 0, 'Bob cannot see Alice''s jobs');
select is((select count(*) from public.collections)::int, 0, 'Bob cannot see Alice''s collection');

-- Act as Alice
select set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is((select count(*) from public.documents)::int, 1, 'Alice sees her document');
select is((select count(*) from public.jobs)::int, 1, 'Alice sees her job');

-- Share the collection with Bob → Bob sees documents in it
reset role;
update public.documents set collection_id = 'aaaaaaaa-0000-0000-0000-000000000001' where id = 'd0000000-0000-0000-0000-000000000001';
insert into public.collection_members values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
update public.profiles set role = 'viewer' where id = '22222222-2222-2222-2222-222222222222';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
select is((select count(*) from public.documents)::int, 1, 'Bob sees documents in a shared collection');

-- Viewer cannot write
select throws_ok(
  $$insert into public.documents (owner, title, mime) values ('22222222-2222-2222-2222-222222222222', 'x', 'text/plain')$$,
  '42501', null, 'Viewer role cannot insert documents'
);

select * from finish();
rollback;
