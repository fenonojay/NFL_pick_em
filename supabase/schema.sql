-- Enable extensions
create extension if not exists pgcrypto;

create type rule_mode as enum ('WINNER_NO_REPEAT', 'LOSER');
create type pick_type as enum ('REGULAR', 'PLAYOFF');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  abbreviation text not null unique,
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year int not null,
  rule_mode rule_mode not null,
  is_active boolean not null default false,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (year, name)
);

create unique index if not exists one_active_season_idx on seasons (is_active) where is_active = true;

create table if not exists weeks (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references seasons(id) on delete cascade,
  week_number int not null,
  is_playoff boolean not null default false,
  lock_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (season_id, week_number)
);

create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id) on delete cascade,
  home_team_id uuid not null references teams(id),
  away_team_id uuid not null references teams(id),
  kickoff_at timestamptz not null,
  winner_team_id uuid references teams(id),
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create table if not exists picks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  season_id uuid not null references seasons(id) on delete cascade,
  week_id uuid not null references weeks(id) on delete cascade,
  game_id uuid references games(id) on delete cascade,
  team_id uuid not null references teams(id),
  pick_type pick_type not null,
  is_correct boolean,
  created_at timestamptz not null default now(),
  check ((pick_type = 'PLAYOFF' and game_id is not null) or (pick_type = 'REGULAR' and game_id is null))
);

-- Exactly one regular pick per user/week, one playoff pick per user/game.
create unique index if not exists uniq_regular_pick on picks (user_id, week_id)
where pick_type = 'REGULAR';

create unique index if not exists uniq_playoff_pick on picks (user_id, game_id)
where pick_type = 'PLAYOFF';

-- Utility: admin check from profile.
create or replace function is_admin(uid uuid)
returns boolean
language sql
stable
as $$
  select coalesce((select p.is_admin from profiles p where p.id = uid), false);
$$;

-- Server-side validation trigger for pick rules.
create or replace function validate_pick_rules()
returns trigger
language plpgsql
security definer
as $$
declare
  _lock_at timestamptz;
  _is_playoff boolean;
  _season_rule rule_mode;
begin
  select w.lock_at, w.is_playoff, s.rule_mode
  into _lock_at, _is_playoff, _season_rule
  from weeks w
  join seasons s on s.id = w.season_id
  where w.id = new.week_id;

  if _lock_at <= now() then
    raise exception 'Pick is locked for this week/game.';
  end if;

  if new.pick_type = 'REGULAR' then
    if _is_playoff then
      raise exception 'Regular picks are not allowed in playoffs.';
    end if;

    if _season_rule = 'LOSER' then
      -- allowed; correctness computed when result entered.
      null;
    elsif exists (
      select 1
      from picks p
      where p.user_id = new.user_id
        and p.season_id = new.season_id
        and p.pick_type = 'REGULAR'
        and p.team_id = new.team_id
    ) then
      raise exception 'No-repeat rule: team already used this season.';
    end if;
  else
    if not _is_playoff then
      raise exception 'Playoff picks require a playoff week.';
    end if;

    if new.game_id is null then
      raise exception 'Playoff picks require a game_id.';
    end if;

    if exists (
      select 1 from games g
      where g.id = new.game_id
        and g.week_id = new.week_id
        and new.team_id in (g.home_team_id, g.away_team_id)
    ) then
      null;
    else
      raise exception 'Playoff pick team must be in the game.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists picks_rules_trigger on picks;
create trigger picks_rules_trigger
before insert on picks
for each row
execute function validate_pick_rules();

-- Recompute correctness for picks when results are entered.
create or replace function grade_game_picks(p_game_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  _winner uuid;
  _week uuid;
  _is_playoff boolean;
  _rule rule_mode;
  _home uuid;
  _away uuid;
begin
  select g.winner_team_id, g.week_id, w.is_playoff, s.rule_mode, g.home_team_id, g.away_team_id
  into _winner, _week, _is_playoff, _rule, _home, _away
  from games g
  join weeks w on w.id = g.week_id
  join seasons s on s.id = w.season_id
  where g.id = p_game_id;

  if _winner is null then
    return;
  end if;

  if _is_playoff then
    update picks
      set is_correct = (team_id = _winner)
      where game_id = p_game_id and pick_type = 'PLAYOFF';
  else
    if _rule = 'WINNER_NO_REPEAT' then
      update picks
        set is_correct = (team_id = _winner)
        where week_id = _week
          and pick_type = 'REGULAR'
          and team_id in (_home, _away);
    else
      update picks
        set is_correct = (team_id <> _winner)
        where week_id = _week
          and pick_type = 'REGULAR'
          and team_id in (_home, _away);
    end if;
  end if;
end;
$$;

create or replace view standings_view as
select
  p.season_id,
  p.user_id,
  pr.display_name,
  coalesce(sum(case when p.pick_type = 'REGULAR' and p.is_correct then 1 else 0 end), 0) as regular_points,
  coalesce(sum(case when p.pick_type = 'PLAYOFF' and p.is_correct then 1 else 0 end), 0) as playoff_points,
  coalesce(sum(case when p.is_correct then 1 else 0 end), 0) as overall_points
from picks p
join profiles pr on pr.id = p.user_id
group by p.season_id, p.user_id, pr.display_name;

alter table profiles enable row level security;
alter table seasons enable row level security;
alter table weeks enable row level security;
alter table games enable row level security;
alter table picks enable row level security;
alter table teams enable row level security;

create policy "read all profiles" on profiles for select using (auth.uid() is not null);
create policy "update own profile" on profiles for update using (auth.uid() = id);

create policy "read seasons" on seasons for select using (auth.uid() is not null);
create policy "admins manage seasons" on seasons for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "read weeks" on weeks for select using (auth.uid() is not null);
create policy "admins manage weeks" on weeks for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "read games" on games for select using (auth.uid() is not null);
create policy "admins manage games" on games for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "read teams" on teams for select using (auth.uid() is not null);
create policy "admins manage teams" on teams for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy "read picks" on picks for select using (auth.uid() is not null);
create policy "users insert own picks" on picks for insert with check (auth.uid() = user_id);
create policy "users update own picks" on picks for update using (auth.uid() = user_id);
create policy "admins manage picks" on picks for all using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
