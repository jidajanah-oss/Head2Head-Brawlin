begin;

-- Use the same direct account-link authorization as load_member_league_roster.
-- This supports linked players, including Computer Access, without table-read fallbacks.
create or replace function public.load_member_league_week(
  target_league_id uuid, target_season integer
)
returns smallint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  league_week smallint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.account_links as links
    join public.league_players as player
      on player.league_id = links.league_id and player.player_id = links.player_id
    where links.league_id = target_league_id and links.user_id = auth.uid()
      and links.active and player.status = 'active'
  ) then
    raise exception 'League membership is required.' using errcode = '42501';
  end if;

  select l.current_week into league_week from public.leagues as l
  where l.id = target_league_id and l.season = target_season;
  if not found then
    raise exception 'The linked league season was not found.';
  end if;
  return league_week;
end;
$$;

create or replace function public.set_commissioner_league_week(
  target_league_id uuid, target_season integer, expected_week smallint, target_week smallint
)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved_week smallint;
begin
  if auth.uid() is null or not exists (
    select 1 from public.account_links as links
    join public.league_players as player
      on player.league_id = links.league_id and player.player_id = links.player_id
    where links.league_id = target_league_id and links.user_id = auth.uid()
      and links.active and player.status = 'active'
      and player.role in ('commissioner', 'backup_commissioner')
  ) then
    raise exception 'Commissioner access is required.' using errcode = '42501';
  end if;
  if target_week is null or target_week not between 1 and 18
    or expected_week is null or expected_week not between 1 and 18 then
    raise exception 'Select a regular-season week from 1 through 18.' using errcode = '22023';
  end if;

  -- Atomic compare-and-set; never update history, picks, assignments, or scores.
  update public.leagues as l set current_week = target_week
  where l.id = target_league_id and l.season = target_season
    and l.current_week = expected_week
  returning l.current_week into saved_week;
  if not found then
    raise exception 'The league week changed on another device or the season does not match. Refresh and try again.' using errcode = '40001';
  end if;
  return saved_week;
end;
$$;

alter function public.load_member_league_week(uuid, integer) owner to postgres;
alter function public.set_commissioner_league_week(uuid, integer, smallint, smallint) owner to postgres;
revoke all on function public.load_member_league_week(uuid, integer) from public, anon;
revoke all on function public.set_commissioner_league_week(uuid, integer, smallint, smallint) from public, anon;
grant execute on function public.load_member_league_week(uuid, integer) to authenticated;
grant execute on function public.set_commissioner_league_week(uuid, integer, smallint, smallint) to authenticated;
notify pgrst, 'reload schema';

commit;
