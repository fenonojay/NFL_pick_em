-- Sample users (password: Password123!)
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@family.local', crypt('Password123!', gen_salt('bf')), now(), now(), now()),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alex@family.local', crypt('Password123!', gen_salt('bf')), now(), now(), now()),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'jamie@family.local', crypt('Password123!', gen_salt('bf')), now(), now(), now())
on conflict (id) do nothing;

insert into profiles (id, display_name, is_admin)
values
  ('11111111-1111-1111-1111-111111111111', 'Family Admin', true),
  ('22222222-2222-2222-2222-222222222222', 'Alex', false),
  ('33333333-3333-3333-3333-333333333333', 'Jamie', false)
on conflict (id) do nothing;

insert into teams (id, abbreviation, name)
values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','KC','Kansas City Chiefs'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2','BUF','Buffalo Bills'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3','BAL','Baltimore Ravens'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4','SF','San Francisco 49ers'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5','DET','Detroit Lions'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6','DAL','Dallas Cowboys')
on conflict (abbreviation) do nothing;

insert into seasons (id, name, year, rule_mode, is_active, created_by)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Family 2026', 2026, 'WINNER_NO_REPEAT', true, '11111111-1111-1111-1111-111111111111')
on conflict (year, name) do nothing;

insert into weeks (id, season_id, week_number, is_playoff, lock_at)
values
  ('cccccccc-cccc-cccc-cccc-ccccccccccc1','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',1,false,now() + interval '2 day'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc2','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',2,false,now() + interval '9 day'),
  ('cccccccc-cccc-cccc-cccc-ccccccccccc3','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',19,true,now() + interval '120 day')
on conflict (season_id, week_number) do nothing;

insert into games (id, week_id, home_team_id, away_team_id, kickoff_at)
values
  ('dddddddd-dddd-dddd-dddd-ddddddddddd1','cccccccc-cccc-cccc-cccc-ccccccccccc1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',now() + interval '2 day'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd2','cccccccc-cccc-cccc-cccc-ccccccccccc1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4',now() + interval '2 day'),
  ('dddddddd-dddd-dddd-dddd-ddddddddddd3','cccccccc-cccc-cccc-cccc-ccccccccccc3','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa5','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa6',now() + interval '120 day')
on conflict (id) do nothing;

-- Optional sample picks
insert into picks (user_id, season_id, week_id, team_id, pick_type)
values
  ('22222222-2222-2222-2222-222222222222','bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','cccccccc-cccc-cccc-cccc-ccccccccccc1','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1','REGULAR')
on conflict do nothing;
