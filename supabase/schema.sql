create extension if not exists pgcrypto;

create type public.user_role as enum ('admin','commissioner','coach','viewer');
create type public.draft_type as enum ('male_female','coed');
create type public.draft_status as enum ('setup','live','paused','complete');
create type public.gender_type as enum ('male','female','any');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role public.user_role not null default 'coach',
  created_at timestamptz default now()
);

create table public.drafts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type public.draft_type not null default 'coed',
  status public.draft_status not null default 'setup',
  commissioner_id uuid references public.profiles(id),
  phase_order text[] not null default array['female','male'],
  current_phase text default 'female',
  current_pick_index int not null default 0,
  pick_seconds int not null default 90,
  pick_started_at timestamptz,
  reveal_until timestamptz,
  reveal_pick_id uuid,
  tv_code text unique default upper(substr(encode(gen_random_bytes(4),'hex'),1,8)),
  created_at timestamptz default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  name text not null,
  logo_url text,
  coach_user_id uuid references public.profiles(id),
  coach_player_id uuid,
  draft_order int,
  created_at timestamptz default now()
);

create table public.players (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  random_number int not null,
  name text not null,
  gender public.gender_type not null default 'any',
  primary_position text,
  secondary_position text,
  is_coach boolean default false,
  assigned_team_id uuid references public.teams(id),
  drafted_team_id uuid references public.teams(id),
  drafted_pick_id uuid,
  created_at timestamptz default now(),
  unique(draft_id, random_number)
);

create table public.picks (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  pick_number int not null,
  phase text not null,
  round_number int not null,
  team_id uuid not null references public.teams(id),
  player_id uuid not null references public.players(id),
  made_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  unique(draft_id, pick_number),
  unique(player_id)
);

create table public.queues (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.drafts(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  rank int not null,
  created_at timestamptz default now(),
  unique(team_id, player_id)
);

create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles(id,email,full_name)
  values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',''))
  on conflict(id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.drafts enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.picks enable row level security;
alter table public.queues enable row level security;

create policy "profiles readable" on public.profiles for select using (auth.uid() is not null);
create policy "admins manage profiles" on public.profiles for all using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "own profile update" on public.profiles for update using (id=auth.uid());

create policy "authenticated read drafts" on public.drafts for select using (auth.uid() is not null or tv_code is not null);
create policy "admins create drafts" on public.drafts for insert with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));
create policy "admins commissioners update drafts" on public.drafts for update using (exists(select 1 from public.profiles p where p.id=auth.uid() and (p.role='admin' or p.id=commissioner_id)));
create policy "admins delete drafts" on public.drafts for delete using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin'));

create policy "read teams" on public.teams for select using (true);
create policy "manage teams" on public.teams for all using (exists(select 1 from public.profiles p join public.drafts d on d.id=draft_id where p.id=auth.uid() and (p.role='admin' or d.commissioner_id=auth.uid())));

create policy "read players" on public.players for select using (true);
create policy "manage players" on public.players for all using (exists(select 1 from public.profiles p join public.drafts d on d.id=draft_id where p.id=auth.uid() and (p.role='admin' or d.commissioner_id=auth.uid())));

create policy "read picks" on public.picks for select using (true);
create policy "make picks" on public.picks for insert with check (auth.uid() is not null);

create policy "read own queue" on public.queues for select using (exists(select 1 from public.teams t where t.id=team_id and t.coach_user_id=auth.uid()) or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('admin','commissioner')));
create policy "manage own queue" on public.queues for all using (exists(select 1 from public.teams t where t.id=team_id and t.coach_user_id=auth.uid()));

alter publication supabase_realtime add table public.drafts, public.teams, public.players, public.picks, public.queues;
