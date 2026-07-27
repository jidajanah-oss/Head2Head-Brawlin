begin;

create or replace function
public.validate_player_pick()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_player_id text;
  normalized_game_id text;
  normalized_selected_team text;
  normalized_source_player_id text;
  game_week smallint;
  away_team text;
  home_team text;
  source_player_status
    public.league_player_status;
  actor_can_manage boolean;
  actor_owns_player boolean;
begin
  normalized_player_id :=
    nullif(
      btrim(new.player_id),
      ''
    );
  normalized_game_id :=
    nullif(
      btrim(new.game_id),
      ''
    );

  if normalized_player_id is null then
    raise exception
      'A player ID is required for a cloud pick.';
  end if;

  if normalized_game_id is null then
    raise exception
      'A game ID is required for a cloud pick.';
  end if;

  new.player_id :=
    normalized_player_id;
  new.game_id :=
    normalized_game_id;

  select
    games.week,
    upper(btrim(games.away_team)),
    upper(btrim(games.home_team))
  into
    game_week,
    away_team,
    home_team
  from public.league_games as games
  where games.league_id =
      new.league_id
    and games.game_id =
      new.game_id;

  if not found then
    raise exception
      'The cloud pick must target an existing league game.';
  end if;

  new.week := game_week;

  actor_can_manage :=
    coalesce(
      public.can_manage_league(
        new.league_id
      ),
      false
    );
  actor_owns_player :=
    coalesce(
      public.is_own_league_player(
        new.league_id,
        new.player_id
      ),
      false
    );

  if auth.uid() is not null then
    if not (
      actor_can_manage or
      actor_owns_player
    ) then
      raise exception
        'A linked active player account is required to change this cloud pick.';
    end if;

    if not coalesce(
      public.can_edit_player_pick(
        new.league_id,
        new.player_id,
        new.game_id
      ),
      false
    ) then
      raise exception
        'Pick changes are locked for this game.';
    end if;
  end if;

  if new.source =
      'picker_clicker' then
    normalized_source_player_id :=
      nullif(
        btrim(
          new.picker_clicker_source_player_id
        ),
        ''
      );

    if normalized_source_player_id
      is null then
      raise exception
        'A deliberate Picker Clicker choice requires the weekly source player.';
    end if;

    if normalized_source_player_id =
        new.player_id then
      raise exception
        'A player cannot use themselves as the Picker Clicker source.';
    end if;

    select players.status
    into source_player_status
    from public.league_players
      as players
    where players.league_id =
        new.league_id
      and players.player_id =
        normalized_source_player_id;

    if not found
      or source_player_status <>
        'active' then
      raise exception
        'The Picker Clicker source must be an active league player.';
    end if;

    new.selected_team := null;
    new.picker_clicker_source_player_id :=
      normalized_source_player_id;
  else
    if new.source =
        'commissioner'
      and auth.uid() is not null
      and not actor_can_manage then
      raise exception
        'Only a commissioner can create commissioner-sourced picks.';
    end if;

    if new.source not in (
      'player',
      'commissioner'
    ) then
      raise exception
        'The cloud pick contains an unsupported source.';
    end if;

    normalized_selected_team :=
      upper(
        btrim(
          coalesce(
            new.selected_team,
            ''
          )
        )
      );

    if normalized_selected_team
      not in (
        away_team,
        home_team
      ) then
      raise exception
        'The selected team must be one of the teams in the game.';
    end if;

    new.selected_team :=
      normalized_selected_team;
    new.picker_clicker_source_player_id :=
      null;
  end if;

  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.created_by := auth.uid();
    else
      new.created_by :=
        old.created_by;
    end if;

    new.updated_by := auth.uid();
  end if;

  return new;
end;
$$;

create or replace function
public.load_my_player_pick_intents(
  target_league_id uuid,
  target_player_id text,
  target_week smallint default null
)
returns table (
  league_id uuid,
  player_id text,
  game_id text,
  week smallint,
  selected_team text,
  source public.pick_source,
  picker_clicker_source_player_id text,
  submitted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  normalized_player_id text :=
    nullif(
      btrim(target_player_id),
      ''
    );
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required to load cloud picks.';
  end if;

  if target_league_id is null
    or normalized_player_id is null then
    raise exception
      'A league and player are required to load cloud picks.';
  end if;

  if target_week is not null
    and target_week not between 1 and 18 then
    raise exception
      'The cloud-pick week must be between 1 and 18.';
  end if;

  if not (
    public.is_own_league_player(
      target_league_id,
      normalized_player_id
    )
    or public.can_manage_league(
      target_league_id
    )
  ) then
    raise exception
      'A linked active player account is required to load these cloud picks.';
  end if;

  return query
  select
    picks.league_id,
    picks.player_id,
    picks.game_id,
    picks.week,
    picks.selected_team,
    picks.source,
    picks.picker_clicker_source_player_id,
    picks.submitted_at,
    picks.created_at,
    picks.updated_at
  from public.player_picks as picks
  where picks.league_id =
      target_league_id
    and picks.player_id =
      normalized_player_id
    and (
      target_week is null
      or picks.week =
        target_week
    )
  order by
    picks.week,
    picks.game_id;
end;
$$;

create or replace function
public.save_my_player_pick_intent(
  target_league_id uuid,
  target_player_id text,
  target_game_id text,
  target_selected_team text,
  target_source text,
  target_picker_clicker_source_player_id text,
  target_submitted_at timestamptz
)
returns table (
  league_id uuid,
  player_id text,
  game_id text,
  week smallint,
  selected_team text,
  source public.pick_source,
  picker_clicker_source_player_id text,
  submitted_at timestamptz,
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
  normalized_game_id text :=
    nullif(
      btrim(target_game_id),
      ''
    );
  normalized_source text :=
    lower(
      btrim(
        coalesce(
          target_source,
          ''
        )
      )
    );
  actor_can_manage boolean;
  actor_owns_player boolean;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required to save cloud picks.';
  end if;

  if target_league_id is null
    or normalized_player_id is null
    or normalized_game_id is null then
    raise exception
      'A league, player, and game are required to save a cloud pick.';
  end if;

  actor_can_manage :=
    coalesce(
      public.can_manage_league(
        target_league_id
      ),
      false
    );
  actor_owns_player :=
    coalesce(
      public.is_own_league_player(
        target_league_id,
        normalized_player_id
      ),
      false
    );

  if not (
    actor_can_manage or
    actor_owns_player
  ) then
    raise exception
      'A linked active player account is required to save this cloud pick.';
  end if;

  if not coalesce(
    public.can_edit_player_pick(
      target_league_id,
      normalized_player_id,
      normalized_game_id
    ),
    false
  ) then
    raise exception
      'Pick changes are locked for this game.';
  end if;

  if actor_can_manage then
    if normalized_source not in (
      'player',
      'picker_clicker',
      'commissioner'
    ) then
      raise exception
        'The cloud pick contains an unsupported source.';
    end if;
  elsif normalized_source not in (
    'player',
    'picker_clicker'
  ) then
    raise exception
      'Players may save only manual or deliberate Picker Clicker choices.';
  end if;

  return query
  insert into public.player_picks
    as picks (
      league_id,
      player_id,
      game_id,
      selected_team,
      source,
      picker_clicker_source_player_id,
      submitted_at,
      created_by,
      updated_by
    )
  values (
    target_league_id,
    normalized_player_id,
    normalized_game_id,
    nullif(
      upper(
        btrim(
          coalesce(
            target_selected_team,
            ''
          )
        )
      ),
      ''
    ),
    normalized_source::public.pick_source,
    nullif(
      btrim(
        target_picker_clicker_source_player_id
      ),
      ''
    ),
    target_submitted_at,
    auth.uid(),
    auth.uid()
  )
  on conflict on constraint
    player_picks_pkey
  do update
  set
    selected_team =
      excluded.selected_team,
    source =
      excluded.source,
    picker_clicker_source_player_id =
      excluded.picker_clicker_source_player_id,
    submitted_at =
      excluded.submitted_at,
    updated_by =
      auth.uid()
  returning
    picks.league_id,
    picks.player_id,
    picks.game_id,
    picks.week,
    picks.selected_team,
    picks.source,
    picks.picker_clicker_source_player_id,
    picks.submitted_at,
    picks.created_at,
    picks.updated_at;
end;
$$;

create or replace function
public.clear_my_player_pick_intent(
  target_league_id uuid,
  target_player_id text,
  target_game_id text
)
returns boolean
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
  normalized_game_id text :=
    nullif(
      btrim(target_game_id),
      ''
    );
  deleted_count integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required to clear cloud picks.';
  end if;

  if target_league_id is null
    or normalized_player_id is null
    or normalized_game_id is null then
    raise exception
      'A league, player, and game are required to clear a cloud pick.';
  end if;

  if not (
    public.can_manage_league(
      target_league_id
    )
    or public.is_own_league_player(
      target_league_id,
      normalized_player_id
    )
  ) then
    raise exception
      'A linked active player account is required to clear this cloud pick.';
  end if;

  if not coalesce(
    public.can_edit_player_pick(
      target_league_id,
      normalized_player_id,
      normalized_game_id
    ),
    false
  ) then
    raise exception
      'Pick changes are locked for this game.';
  end if;

  delete from public.player_picks
  where player_picks.league_id =
      target_league_id
    and player_picks.player_id =
      normalized_player_id
    and player_picks.game_id =
      normalized_game_id;

  get diagnostics
    deleted_count =
      row_count;

  return deleted_count > 0;
end;
$$;

revoke all on function
public.load_my_player_pick_intents(
  uuid,
  text,
  smallint
)
from public, anon;

revoke all on function
public.save_my_player_pick_intent(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
from public, anon;

revoke all on function
public.clear_my_player_pick_intent(
  uuid,
  text,
  text
)
from public, anon;

grant execute on function
public.load_my_player_pick_intents(
  uuid,
  text,
  smallint
)
to authenticated;

grant execute on function
public.save_my_player_pick_intent(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
to authenticated;

grant execute on function
public.clear_my_player_pick_intent(
  uuid,
  text,
  text
)
to authenticated;

comment on function
public.load_my_player_pick_intents(
  uuid,
  text,
  smallint
)
is
  'Loads protected player pick intents after directly validating the signed-in linked account.';

comment on function
public.save_my_player_pick_intent(
  uuid,
  text,
  text,
  text,
  text,
  text,
  timestamptz
)
is
  'Saves a manual or deliberate Picker Clicker choice through protected linked-player authorization.';

comment on function
public.clear_my_player_pick_intent(
  uuid,
  text,
  text
)
is
  'Clears an editable cloud pick through protected linked-player authorization.';

notify pgrst, 'reload schema';

commit;
