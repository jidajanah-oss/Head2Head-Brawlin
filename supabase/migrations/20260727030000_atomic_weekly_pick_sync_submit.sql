begin;

create or replace function
public.submit_weekly_picks_with_intents(
  target_league_id uuid,
  target_player_id text,
  target_week smallint,
  target_intents jsonb
)
returns table (
  league_id uuid,
  player_id text,
  week smallint,
  submitted_at timestamptz,
  reopened_at timestamptz,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_player_id text :=
    nullif(
      btrim(target_player_id),
      ''
    );
  league_season integer;
  intent_count integer;
  distinct_game_count integer;
  intent_record record;
  intent_game_week smallint;
begin
  if auth.uid() is null then
    raise exception
      'A signed-in account is required to synchronize and submit weekly picks.';
  end if;

  if target_league_id is null then
    raise exception
      'A league is required to synchronize and submit weekly picks.';
  end if;

  if normalized_player_id is null then
    raise exception
      'A player is required to synchronize and submit weekly picks.';
  end if;

  if target_week is null
    or target_week not between 1 and 18 then
    raise exception
      'The submission week must be between 1 and 18.';
  end if;

  if not coalesce(
    public.is_own_league_player(
      target_league_id,
      normalized_player_id
    ),
    false
  ) then
    raise exception
      'Players may submit only their own linked weekly entry.';
  end if;

  if target_intents is null
    or jsonb_typeof(target_intents) <> 'array' then
    raise exception
      'The weekly submission must include a JSON array of current choices.';
  end if;

  select leagues.season
  into league_season
  from public.leagues as leagues
  where leagues.id =
      target_league_id
    and leagues.current_week =
      target_week;

  if not found then
    raise exception
      'Only the league current week may be submitted.';
  end if;

  select
    jsonb_array_length(
      target_intents
    ),
    count(
      distinct
      nullif(
        btrim(
          intents.value->>'game_id'
        ),
        ''
      )
    )::integer
  into
    intent_count,
    distinct_game_count
  from jsonb_array_elements(
    target_intents
  ) as intents(value);

  if intent_count >
      18 then
    raise exception
      'The weekly submission contains too many choices.';
  end if;

  if intent_count <>
      distinct_game_count then
    raise exception
      'The weekly submission contains duplicate or missing game IDs.';
  end if;

  delete from public.player_picks
    as picks
  using public.league_games
    as games
  where picks.league_id =
      target_league_id
    and picks.player_id =
      normalized_player_id
    and picks.game_id =
      games.game_id
    and games.league_id =
      target_league_id
    and games.season =
      league_season
    and games.week =
      target_week
    and public.is_pick_open(
      target_league_id,
      games.game_id
    )
    and not exists (
      select 1
      from jsonb_array_elements(
        target_intents
      ) as submitted(value)
      where nullif(
        btrim(
          submitted.value->>'game_id'
        ),
        ''
      ) =
        games.game_id
    );

  for intent_record in
    select
      nullif(
        btrim(
          intents.value->>'game_id'
        ),
        ''
      ) as game_id,
      nullif(
        btrim(
          intents.value->>'selected_team'
        ),
        ''
      ) as selected_team,
      lower(
        nullif(
          btrim(
            intents.value->>'source'
          ),
          ''
        )
      ) as source,
      nullif(
        btrim(
          intents.value->
            'picker_clicker_source_player_id'
            #>> '{}'
        ),
        ''
      ) as picker_clicker_source_player_id,
      nullif(
        btrim(
          intents.value->
            'submitted_at'
            #>> '{}'
        ),
        ''
      ) as submitted_at
    from jsonb_array_elements(
      target_intents
    ) as intents(value)
  loop
    if intent_record.game_id
      is null then
      raise exception
        'Every synchronized choice requires a game ID.';
    end if;

    select games.week
    into intent_game_week
    from public.league_games
      as games
    where games.league_id =
        target_league_id
      and games.game_id =
        intent_record.game_id
      and games.season =
        league_season;

    if not found
      or intent_game_week <>
        target_week then
      raise exception
        'Every synchronized choice must belong to the current league week.';
    end if;

    perform *
    from public.save_my_player_pick_intent(
      target_league_id,
      normalized_player_id,
      intent_record.game_id,
      intent_record.selected_team,
      intent_record.source,
      intent_record.picker_clicker_source_player_id,
      case
        when intent_record.submitted_at
          is null then null
        else
          intent_record.submitted_at::timestamptz
      end
    );
  end loop;

  return query
  select *
  from public.submit_weekly_picks(
    target_league_id,
    normalized_player_id,
    target_week
  );
end;
$$;

revoke all on function
public.submit_weekly_picks_with_intents(
  uuid,
  text,
  smallint,
  jsonb
)
from public, anon;

grant execute on function
public.submit_weekly_picks_with_intents(
  uuid,
  text,
  smallint,
  jsonb
)
to authenticated;

comment on function
public.submit_weekly_picks_with_intents(
  uuid,
  text,
  smallint,
  jsonb
)
is
  'Atomically synchronizes the signed-in player current local weekly choices and submits the week only after every open game is safely stored.';

notify pgrst, 'reload schema';

commit;
