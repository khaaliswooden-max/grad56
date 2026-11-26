-- Grid & Grain Field Guide: member accounts.
-- Run once in the Supabase SQL editor (Database > SQL Editor > New query > paste > Run).
-- Stores only: email (held by Supabase Auth), consent flags, optional role, self-check scores,
-- and certificate details the member types in. Every table has row-level security on.

create extension if not exists pgcrypto;

-- The module calendar. A score can only be saved for a module that has opened.
create table if not exists public.modules (
  n        smallint primary key check (n between 1 and 12),
  title    text not null,
  opens_on date not null
);
insert into public.modules (n, title, opens_on) values
  (1,  'The Wire to Your Porch',                '2027-01-05'),
  (2,  'Who Pays for the Substation?',          '2027-02-02'),
  (3,  'Why AI Eats Power',                     '2027-03-02'),
  (4,  'The Water Question',                    '2027-04-06'),
  (5,  'Noise, Light, and Land',                '2027-05-04'),
  (6,  'The Rural Hospital Runs on Compute',    '2027-06-01'),
  (7,  'Sun, Storage, and Flexible Load',       '2027-07-06'),
  (8,  'The Jobs Question',                     '2027-08-03'),
  (9,  'AI on the Farm',                        '2027-09-07'),
  (10, 'Making the Deal',                       '2027-10-05'),
  (11, 'Small Is Possible',                     '2027-11-02'),
  (12, 'The Three Clocks',                      '2027-12-07')
on conflict (n) do update set title = excluded.title, opens_on = excluded.opens_on;

alter table public.modules enable row level security;
drop policy if exists "modules are public" on public.modules;
create policy "modules are public" on public.modules for select using (true);

-- One row per member, created automatically at first sign-in.
create table if not exists public.members (
  id                  uuid primary key references auth.users (id) on delete cascade,
  created_at          timestamptz not null default now(),
  age_13_confirmed    boolean not null default false,
  wants_monthly_note  boolean not null default false,
  role                text check (role in ('official', 'coop', 'resident', 'hospital', 'farm', 'student', 'other'))
);
alter table public.members enable row level security;
drop policy if exists "members read own row" on public.members;
create policy "members read own row" on public.members for select using (id = auth.uid());
drop policy if exists "members update own row" on public.members;
create policy "members update own row" on public.members for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.members from authenticated, anon;
grant update (wants_monthly_note, role) on public.members to authenticated;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Accounts are 13+. The sign-in page asks; this refuses an account created without that answer.
  if coalesce((new.raw_user_meta_data ->> 'age_13_confirmed')::boolean, false) is not true then
    raise exception 'age_13_confirmed is required to create an account';
  end if;
  insert into public.members (id, age_13_confirmed, wants_monthly_note)
  values (
    new.id,
    coalesce((new.raw_user_meta_data ->> 'age_13_confirmed')::boolean, false),
    coalesce((new.raw_user_meta_data ->> 'wants_monthly_note')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Every self-check attempt. The best one counts; a pass is 4 of 5.
create table if not exists public.check_attempts (
  id         bigint generated always as identity primary key,
  member_id  uuid not null references public.members (id) on delete cascade,
  module     smallint not null references public.modules (n),
  score      smallint not null check (score between 0 and 5),
  passed     boolean not null,
  taken_at   timestamptz not null default now(),
  constraint pass_rule check (passed = (score >= 4))
);
create index if not exists check_attempts_member on public.check_attempts (member_id);
alter table public.check_attempts enable row level security;
drop policy if exists "attempts read own" on public.check_attempts;
create policy "attempts read own" on public.check_attempts for select using (member_id = auth.uid());
drop policy if exists "attempts insert own, open modules only" on public.check_attempts;
create policy "attempts insert own, open modules only" on public.check_attempts for insert
  with check (
    member_id = auth.uid()
    and exists (select 1 from public.modules m where m.n = module and m.opens_on <= (now() at time zone 'America/Chicago')::date)
  );

-- One certificate per member, issued only after all twelve self-checks are passed.
create table if not exists public.certificates (
  id            text primary key default encode(gen_random_bytes(9), 'hex'),
  member_id     uuid not null unique references public.members (id) on delete cascade,
  display_name  text not null check (char_length(display_name) between 2 and 80),
  county        text check (char_length(county) <= 60),
  state         text check (char_length(state) <= 40),
  issued_at     timestamptz not null default now()
);
alter table public.certificates enable row level security;
drop policy if exists "certificates read own" on public.certificates;
create policy "certificates read own" on public.certificates for select using (member_id = auth.uid());

create or replace function public.issue_certificate(p_display_name text, p_county text, p_state text)
returns text language plpgsql security definer set search_path = public as $$
declare
  passed_count int;
  cert_id text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select count(distinct module) into passed_count from public.check_attempts
    where member_id = auth.uid() and passed;
  if passed_count < 12 then raise exception 'all twelve self-checks must be passed first'; end if;
  insert into public.certificates (member_id, display_name, county, state)
    values (auth.uid(), trim(p_display_name), nullif(trim(p_county), ''), nullif(trim(p_state), ''))
    on conflict (member_id) do update
      set display_name = excluded.display_name, county = excluded.county, state = excluded.state
    returning id into cert_id;
  return cert_id;
end $$;
revoke all on function public.issue_certificate(text, text, text) from public, anon;
grant execute on function public.issue_certificate(text, text, text) to authenticated;

-- Anyone with a certificate's link can confirm it. Only these four fields are shown.
create or replace function public.get_certificate(p_id text)
returns table (display_name text, county text, state text, issued_at timestamptz)
language sql security definer set search_path = public stable as $$
  select c.display_name, c.county, c.state, c.issued_at from public.certificates c where c.id = p_id;
$$;
grant execute on function public.get_certificate(text) to anon, authenticated;

-- "Delete my account": removes the sign-in and, by cascade, every row tied to it.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- For the monthly note: run this and export the result as CSV for Resend.
create or replace view public.monthly_note_list with (security_invoker = true) as
  select u.email from auth.users u join public.members m on m.id = u.id
  where m.wants_monthly_note
    and u.email_confirmed_at is not null;  -- only addresses whose owner clicked a sign-in link
revoke all on public.monthly_note_list from anon, authenticated;

-- Table access for the website's roles, stated outright rather than left to project defaults.
-- Row-level security above still decides which rows each member can see or write.
grant usage on schema public to anon, authenticated;
grant select on public.modules to anon, authenticated;
grant select on public.members to authenticated;
grant select, insert on public.check_attempts to authenticated;
grant select on public.certificates to authenticated;
