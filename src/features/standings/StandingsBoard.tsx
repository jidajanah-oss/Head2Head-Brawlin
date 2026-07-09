import { useMemo } from "react";
import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildHeadToHeadMatchupResults,
  buildNFLPlayoffBracketShell,
  buildNFLPlayoffPicture,
  buildNFLStyleDivisionStandings,
  formatHeadToHeadRecord,
  formatWeeklyResultLabel,
  type HeadToHeadMatchupResult,
  type NFLConferenceBracketShell,
  type NFLConferencePlayoffPicture,
  type NFLPlayoffBracketMatchup,
  type NFLPlayoffBracketSlot,
  type NFLPlayoffBubbleRow,
  type NFLPlayoffSeedRow,
  type NFLStyleDivisionStandingGroup,
  type NFLStyleDivisionStandingRow,
} from "../../engine";

type BadgeVariant = "gold" | "success" | "danger" | "info" | "neutral";

function getRankDisplay(index: number) {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return `#${index + 1}`;
}

function getRankLabel(index: number) {
  if (index === 0) return "Top Seed";
  if (index === 1) return "Contender";
  if (index === 2) return "Podium";
  return "Chasing";
}

function getResultBadgeVariant(result: string): BadgeVariant {
  if (result === "win") return "success";
  if (result === "loss") return "danger";
  if (result === "tie") return "gold";
  if (result === "bye") return "neutral";
  if (result === "open") return "neutral";
  return "neutral";
}

function getSeedBadgeLabel(player: NFLStyleDivisionStandingRow) {
  if (player.isDivisionLeader) return "Division Leader";
  if (player.isWildcardSeed) return "Wildcard Watch";
  return `#${player.divisionRank} Division`;
}

function getPlayoffBadgeVariant(status: string): BadgeVariant {
  if (status === "division-leader") return "gold";
  if (status === "wildcard") return "success";
  if (status === "bubble") return "neutral";
  return "neutral";
}

function getOpenTeamAbbreviations(division: NFLStyleDivisionStandingGroup) {
  const claimedTeams = new Set(
    division.rows.map((row) => row.nflTeamAbbreviation)
  );

  return division.teams
    .filter((team) => !claimedTeams.has(team.abbreviation))
    .map((team) => team.abbreviation);
}

function formatBubblePointsBack(row: NFLPlayoffBubbleRow) {
  if (row.pointsBack <= 0) {
    return "Tied for line";
  }

  if (row.pointsBack === 1) {
    return "1 point back";
  }

  return `${row.pointsBack} points back`;
}

function getMatchupPlayerATeam(matchup: HeadToHeadMatchupResult) {
  return matchup.playerATeamAbbreviation ?? matchup.playerA.nflTeam;
}

function getMatchupPlayerADisplayName(matchup: HeadToHeadMatchupResult) {
  return matchup.playerATeamDisplayName ?? getMatchupPlayerATeam(matchup);
}

function getMatchupPlayerBTeam(matchup: HeadToHeadMatchupResult) {
  if (matchup.playerB) {
    return matchup.playerBTeamAbbreviation ?? matchup.playerB.nflTeam;
  }

  if (matchup.matchupType === "open-opponent") {
    return matchup.openOpponentTeamAbbreviation ?? "OPEN";
  }

  return "BYE";
}

function getMatchupPlayerBDisplayName(matchup: HeadToHeadMatchupResult) {
  if (matchup.playerB) {
    return matchup.playerBTeamDisplayName ?? getMatchupPlayerBTeam(matchup);
  }

  if (matchup.matchupType === "open-opponent") {
    return matchup.openOpponentTeamDisplayName ?? "Open Team";
  }

  return "Bye Week";
}

function getMatchupOpponentName(matchup: HeadToHeadMatchupResult) {
  if (matchup.playerB) {
    return matchup.playerB.name;
  }

  if (matchup.matchupType === "open-opponent") {
    return matchup.openOpponentTeamDisplayName ?? "Open Team";
  }

  return "Bye Week";
}

function getMatchupSourceLabel(matchup: HeadToHeadMatchupResult) {
  if (matchup.source === "nfl-schedule") {
    if (matchup.matchupType === "open-opponent") {
      return "NFL schedule • open team";
    }

    if (matchup.matchupType === "bye") {
      return "NFL schedule • bye";
    }

    return "NFL schedule";
  }

  return "Rotation fallback";
}

function PlayoffSeedCard({ seed }: { seed: NFLPlayoffSeedRow }) {
  return (
    <article className="standings-playoff-seed-card">
      <div className="standings-playoff-seed-number">
        <FranchiseLogo
          nflTeam={seed.row.nflTeamAbbreviation}
          displayName={seed.row.nflTeamDisplayName}
          size="sm"
        />
        <strong>{seed.seed}</strong>
        <small>Seed</small>
      </div>

      <div className="standings-playoff-seed-main">
        <strong>
          {seed.row.nflTeamAbbreviation} • {seed.row.name}
        </strong>
        <small>
          {seed.row.division} • {formatHeadToHeadRecord(seed.row)} •{" "}
          {seed.row.leaguePoints} pts
        </small>
      </div>

      <SteelBadge variant={getPlayoffBadgeVariant(seed.status)}>
        {seed.seedLabel}
      </SteelBadge>
    </article>
  );
}

function PlayoffBubbleCard({ bubble }: { bubble: NFLPlayoffBubbleRow }) {
  return (
    <article className="standings-playoff-bubble-card">
      <div className="standings-playoff-bubble-rank">
        <FranchiseLogo
          nflTeam={bubble.row.nflTeamAbbreviation}
          displayName={bubble.row.nflTeamDisplayName}
          size="sm"
        />
        <strong>{bubble.bubbleRank}</strong>
        <small>Bubble</small>
      </div>

      <div className="standings-playoff-bubble-main">
        <strong>
          {bubble.row.nflTeamAbbreviation} • {bubble.row.name}
        </strong>
        <small>
          {bubble.row.division} • {formatHeadToHeadRecord(bubble.row)} •{" "}
          {formatBubblePointsBack(bubble)}
        </small>
      </div>

      <SteelBadge variant="neutral">On The Bubble</SteelBadge>
    </article>
  );
}

function PlayoffConferenceCard({
  conference,
}: {
  conference: NFLConferencePlayoffPicture;
}) {
  return (
    <SteelCard className="standings-playoff-card">
      <SteelSectionHeader
        eyebrow={`${conference.conference} Playoff Picture`}
        title={`${conference.conference} Seeds`}
        description="NFL-style format: four division leaders plus three wildcards."
      />

      <div className="standings-playoff-summary">
        <div>
          <span>First-Round Bye</span>
          <strong>
            {conference.firstRoundBye
              ? `${conference.firstRoundBye.row.nflTeamAbbreviation} • ${conference.firstRoundBye.row.name}`
              : "Not set"}
          </strong>
        </div>

        <div>
          <span>Playoff Spots</span>
          <strong>{conference.playoffTeamCount}/7</strong>
        </div>

        <div>
          <span>Bubble Teams</span>
          <strong>{conference.bubbleTeamCount}</strong>
        </div>
      </div>

      <div className="standings-playoff-grid">
        <div className="standings-playoff-column">
          <div className="standings-playoff-column-title">
            <span>Seeds 1–4</span>
            <strong>Division Leaders</strong>
          </div>

          <div className="standings-playoff-seed-list">
            {conference.divisionSeeds.map((seed) => (
              <PlayoffSeedCard key={seed.row.id} seed={seed} />
            ))}

            {conference.divisionSeeds.length === 0 ? (
              <p className="standings-muted">No division leaders yet.</p>
            ) : null}
          </div>
        </div>

        <div className="standings-playoff-column">
          <div className="standings-playoff-column-title">
            <span>Seeds 5–7</span>
            <strong>Wildcard Watch</strong>
          </div>

          <div className="standings-playoff-seed-list">
            {conference.wildcardSeeds.map((seed) => (
              <PlayoffSeedCard key={seed.row.id} seed={seed} />
            ))}

            {conference.wildcardSeeds.length === 0 ? (
              <p className="standings-muted">No wildcard teams yet.</p>
            ) : null}
          </div>
        </div>

        <div className="standings-playoff-column standings-playoff-column--bubble">
          <div className="standings-playoff-column-title">
            <span>Next Up</span>
            <strong>On The Bubble</strong>
          </div>

          <div className="standings-playoff-seed-list">
            {conference.bubbleRows.map((bubble) => (
              <PlayoffBubbleCard key={bubble.row.id} bubble={bubble} />
            ))}

            {conference.bubbleRows.length === 0 ? (
              <p className="standings-muted">No bubble teams yet.</p>
            ) : null}
          </div>
        </div>
      </div>
    </SteelCard>
  );
}

function BracketSlotCard({ slot }: { slot: NFLPlayoffBracketSlot }) {
  return (
    <div
      className={`standings-bracket-slot ${
        slot.isBye ? "is-bye" : slot.isPlaceholder ? "is-placeholder" : ""
      }`.trim()}
    >
      <div className="standings-bracket-slot-seed">
        <FranchiseLogo
          nflTeam={slot.row?.nflTeamAbbreviation}
          displayName={slot.row?.nflTeamDisplayName ?? slot.label}
          size="xs"
          variant={slot.row ? "badge" : "ghost"}
        />
        <strong>{slot.seed ? `#${slot.seed}` : "—"}</strong>
        <small>{slot.isBye ? "Bye" : "Seed"}</small>
      </div>

      <div className="standings-bracket-slot-main">
        <strong>{slot.label}</strong>
        <small>
          {slot.row
            ? `${slot.row.division} • ${formatHeadToHeadRecord(slot.row)} • ${
                slot.row.leaguePoints
              } pts`
            : slot.isBye
              ? "First-round bye"
              : "Pending winner"}
        </small>
      </div>
    </div>
  );
}

function BracketMatchupCard({
  matchup,
}: {
  matchup: NFLPlayoffBracketMatchup;
}) {
  return (
    <article className="standings-bracket-matchup-card">
      <div className="standings-bracket-matchup-topline">
        <span>{matchup.title}</span>
        <strong>{matchup.matchupLabel}</strong>
      </div>

      <div className="standings-bracket-slots">
        <BracketSlotCard slot={matchup.teamA} />

        <div className="standings-bracket-versus">vs</div>

        <BracketSlotCard slot={matchup.teamB} />
      </div>

      <p>{matchup.note}</p>
    </article>
  );
}

function ConferenceBracketCard({
  bracket,
}: {
  bracket: NFLConferenceBracketShell;
}) {
  return (
    <SteelCard className="standings-bracket-card">
      <SteelSectionHeader
        eyebrow={`${bracket.conference} Bracket`}
        title={`${bracket.conference} Playoff Shell`}
        description="Wildcard, divisional, and championship path."
      />

      <div className="standings-bracket-bye-card">
        <span>First-Round Bye</span>
        <BracketSlotCard slot={bracket.firstRoundBye} />
      </div>

      <div className="standings-bracket-round-grid">
        <div className="standings-bracket-round-column">
          <div className="standings-bracket-round-title">
            <span>Round 1</span>
            <strong>Wildcard</strong>
          </div>

          <div className="standings-bracket-matchup-list">
            {bracket.wildcardMatchups.map((matchup) => (
              <BracketMatchupCard key={matchup.id} matchup={matchup} />
            ))}
          </div>
        </div>

        <div className="standings-bracket-round-column">
          <div className="standings-bracket-round-title">
            <span>Round 2</span>
            <strong>Divisional</strong>
          </div>

          <div className="standings-bracket-matchup-list">
            {bracket.divisionalMatchups.map((matchup) => (
              <BracketMatchupCard key={matchup.id} matchup={matchup} />
            ))}
          </div>
        </div>

        <div className="standings-bracket-round-column standings-bracket-round-column--final">
          <div className="standings-bracket-round-title">
            <span>Round 3</span>
            <strong>Championship</strong>
          </div>

          <BracketMatchupCard matchup={bracket.conferenceChampionship} />
        </div>
      </div>
    </SteelCard>
  );
}

function SuperBowlBracketCard({
  matchup,
}: {
  matchup: NFLPlayoffBracketMatchup;
}) {
  return (
    <SteelCard className="standings-super-bowl-card">
      <SteelSectionHeader
        eyebrow="Final"
        title="Super Bowl"
        description="Conference champions meet for the league title."
      />

      <div className="standings-super-bowl-matchup">
        <BracketSlotCard slot={matchup.teamA} />

        <div className="standings-super-bowl-center">
          <span>🏆</span>
          <strong>{matchup.matchupLabel}</strong>
          <small>{matchup.title}</small>
        </div>

        <BracketSlotCard slot={matchup.teamB} />
      </div>

      <p>{matchup.note}</p>
    </SteelCard>
  );
}

function StandingsBoard() {
  const { league, picks, gameResults, activePlayerId } = useLeague();

  const {
    snapshot,
    loading: nflLoading,
    error: nflError,
    week: nflWeek,
  } = useNFL();

  const nflGames = useMemo(() => snapshot?.nflGames ?? [], [snapshot]);

  const allPicks = useMemo(
    () =>
      league.players.reduce<Record<string, Record<string, string>>>(
        (playerPicks, player) => {
          playerPicks[player.id] = picks[player.id] || {};
          return playerPicks;
        },
        {}
      ),
    [league.players, picks]
  );

  const divisionStandings = useMemo(
    () =>
      buildNFLStyleDivisionStandings(
        league.players,
        allPicks,
        gameResults,
        league.currentWeek,
        nflGames
      ),
    [league.players, allPicks, gameResults, league.currentWeek, nflGames]
  );

  const playoffPicture = useMemo(
    () => buildNFLPlayoffPicture(divisionStandings),
    [divisionStandings]
  );

  const bracketShell = useMemo(
    () => buildNFLPlayoffBracketShell(playoffPicture),
    [playoffPicture]
  );

  const standings = divisionStandings.allRows;

  const weeklyMatchups = useMemo(
    () =>
      buildHeadToHeadMatchupResults(
        league.players,
        allPicks,
        gameResults,
        league.currentWeek,
        nflGames
      ),
    [league.players, allPicks, gameResults, league.currentWeek, nflGames]
  );

  const leader = standings[0];

  const activePlayerStanding = standings.find(
    (player) => player.id === activePlayerId
  );

  const activePlayoffSeed = playoffPicture.conferences
    .flatMap((conference) => conference.seeds)
    .find((seed) => seed.row.id === activePlayerId);

  const usingNFLSchedule = nflGames.length > 0;

  const scheduleHelper = nflError
    ? "NFL schedule unavailable"
    : usingNFLSchedule
      ? `${nflGames.length} NFL games loaded`
      : nflLoading
        ? "Loading NFL schedule"
        : "Using rotation fallback";

  return (
    <div className="standings standings-v2">
      <SteelHero
        eyebrow={`Week ${nflWeek ?? league.currentWeek} Standings`}
        title="NFL-Style League Standings"
        subtitle="Division standings, playoff picture, bracket shell, and weekly head-to-head matchups."
        rightContent={
          <div className="standings-hero-panel">
            <span>Current Top Seed</span>

            <div className="standings-logo-shell">
              <FranchiseLogo
                nflTeam={leader?.nflTeamAbbreviation}
                displayName={leader?.nflTeamDisplayName}
                size="md"
                variant="tile"
              />

              <div>
                <strong>
                  {leader ? `${leader.nflTeamAbbreviation} • ${leader.name}` : "—"}
                </strong>
                <small>
                  {leader
                    ? `${leader.division} • ${formatHeadToHeadRecord(
                        leader
                      )} • ${leader.leaguePoints} pts`
                    : "No results yet"}
                </small>
              </div>
            </div>
          </div>
        }
      />

      <div className="standings-stat-grid">
        <SteelStatCard
          label="Claimed Teams"
          value={`${divisionStandings.claimedTeamCount}/${divisionStandings.totalTeamCount}`}
          helper={`${divisionStandings.openTeamCount} open franchises`}
          icon="🏈"
        />

        <SteelStatCard
          label="Occupied Divisions"
          value={`${divisionStandings.occupiedDivisionCount}/8`}
          helper="NFL division groups"
          icon="🧱"
        />

        <SteelStatCard
          label="Schedule"
          value={usingNFLSchedule ? "NFL" : "Fallback"}
          helper={scheduleHelper}
          icon="📅"
        />

        <SteelStatCard
          label="Active Seed"
          value={activePlayoffSeed ? `#${activePlayoffSeed.seed}` : "—"}
          helper={
            activePlayerStanding
              ? `${activePlayerStanding.nflTeamAbbreviation} • ${activePlayerStanding.name}`
              : "No active player standing"
          }
          icon="⭐"
        />
      </div>

      <div className="standings-playoff-stack">
        {playoffPicture.conferences.map((conference) => (
          <PlayoffConferenceCard
            key={conference.conference}
            conference={conference}
          />
        ))}
      </div>

      <div className="standings-bracket-stack">
        {bracketShell.conferences.map((bracket) => (
          <ConferenceBracketCard key={bracket.conference} bracket={bracket} />
        ))}

        <SuperBowlBracketCard matchup={bracketShell.superBowl} />
      </div>

      <SteelCard className="standings-matchups-card">
        <SteelSectionHeader
          eyebrow="Weekly Head-To-Head"
          title={`Week ${league.currentWeek} Matchups`}
          description="Matchups mirror the real NFL schedule when NFL games are loaded."
        />

        <div className="standings-matchups-grid">
          {weeklyMatchups.map((matchup) => (
            <article className="standings-matchup-item" key={matchup.id}>
              <div className="standings-matchup-player">
                <div className="franchise-logo-line">
                  <FranchiseLogo
                    nflTeam={getMatchupPlayerATeam(matchup)}
                    customLogo={matchup.playerA.customLogo}
                    displayName={getMatchupPlayerADisplayName(matchup)}
                    size="sm"
                  />

                  <div className="franchise-logo-line__text">
                    <small>{getMatchupPlayerATeam(matchup)}</small>
                    <strong>{matchup.playerA.name}</strong>
                  </div>
                </div>

                <span>{matchup.playerAScore}</span>
              </div>

              <div className="standings-matchup-center">
                <small>{getMatchupSourceLabel(matchup)}</small>
                <SteelBadge variant={getResultBadgeVariant(matchup.matchupType ?? "")}>
                  {matchup.resultLabel}
                </SteelBadge>
              </div>

              <div className="standings-matchup-player is-right">
                <div className="franchise-logo-line">
                  <FranchiseLogo
                    nflTeam={getMatchupPlayerBTeam(matchup)}
                    customLogo={matchup.playerB?.customLogo}
                    displayName={getMatchupPlayerBDisplayName(matchup)}
                    size="sm"
                  />

                  <div className="franchise-logo-line__text">
                    <small>{getMatchupPlayerBTeam(matchup)}</small>
                    <strong>{getMatchupOpponentName(matchup)}</strong>
                  </div>
                </div>

                <span>{matchup.playerB ? matchup.playerBScore : "—"}</span>
              </div>
            </article>
          ))}

          {weeklyMatchups.length === 0 ? (
            <SteelCard className="standings-empty-card">
              No weekly matchups available yet.
            </SteelCard>
          ) : null}
        </div>
      </SteelCard>

      <div className="standings-conference-stack">
        {divisionStandings.conferences.map((conference) => (
          <SteelCard
            className="standings-conference-card"
            key={conference.conference}
          >
            <SteelSectionHeader
              eyebrow={`${conference.conference} Conference`}
              title={`${conference.conference} Divisions`}
              description="Division leaders and wildcard contenders are calculated from league points."
            />

            <div className="standings-division-grid">
              {conference.divisions.map((division) => {
                const openTeams = getOpenTeamAbbreviations(division);

                return (
                  <div className="standings-division-card" key={division.division}>
                    <div className="standings-division-topline">
                      <div>
                        <span>{division.division}</span>
                        <strong>
                          {division.leader
                            ? `${division.leader.nflTeamAbbreviation} • ${division.leader.name}`
                            : "Open Division"}
                        </strong>
                      </div>

                      <SteelBadge
                        variant={division.claimedCount === 4 ? "success" : "neutral"}
                      >
                        {division.claimedCount}/4 Claimed
                      </SteelBadge>
                    </div>

                    <div className="standings-division-table">
                      {division.rows.map((player) => (
                        <div
                          className={`standings-division-row ${
                            player.id === activePlayerId ? "is-active-player" : ""
                          }`.trim()}
                          key={player.id}
                        >
                          <div className="standings-division-rank">
                            <FranchiseLogo
                              nflTeam={player.nflTeamAbbreviation}
                              displayName={player.nflTeamDisplayName}
                              size="sm"
                            />
                            <strong>{player.divisionRank}</strong>
                            <small>{player.nflTeamAbbreviation}</small>
                          </div>

                          <div className="standings-division-player">
                            <strong>{player.name}</strong>
                            <small>{player.nflTeamDisplayName}</small>
                          </div>

                          <div className="standings-division-record">
                            <strong>{formatHeadToHeadRecord(player)}</strong>
                            <small>REC</small>
                          </div>

                          <div className="standings-division-points">
                            <strong>{player.leaguePoints}</strong>
                            <small>PTS</small>
                          </div>

                          <SteelBadge
                            variant={
                              player.isDivisionLeader
                                ? "gold"
                                : player.isWildcardSeed
                                  ? "success"
                                  : "neutral"
                            }
                          >
                            {getSeedBadgeLabel(player)}
                          </SteelBadge>
                        </div>
                      ))}

                      {division.rows.length === 0 ? (
                        <SteelCard className="standings-empty-card">
                          No franchise owner in this division yet.
                        </SteelCard>
                      ) : null}
                    </div>

                    {openTeams.length > 0 ? (
                      <div className="standings-open-teams">
                        <span>Open teams</span>
                        <strong>{openTeams.join(" • ")}</strong>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </SteelCard>
        ))}
      </div>

      <SteelCard className="standings-podium-card">
        <SteelSectionHeader
          eyebrow="League Leaders"
          title="Top 3"
          description="Current top records by league points."
        />

        <div className="standings-podium-grid">
          {standings.slice(0, 3).map((player, index) => (
            <article
              className={`standings-podium-item standings-podium-item--${
                index + 1
              }`}
              key={player.id}
            >
              <FranchiseLogo
                nflTeam={player.nflTeamAbbreviation}
                displayName={player.nflTeamDisplayName}
                size="lg"
                variant="tile"
              />
              <span>{getRankDisplay(index)}</span>
              <strong>
                {player.nflTeamAbbreviation} • {player.name}
              </strong>
              <small>
                {player.division} • {formatHeadToHeadRecord(player)} •{" "}
                {player.leaguePoints} pts
              </small>
            </article>
          ))}

          {standings.length === 0 ? (
            <SteelCard className="standings-empty-card">
              No standings available yet.
            </SteelCard>
          ) : null}
        </div>
      </SteelCard>

      <div className="standings-board-section">
        <SteelSectionHeader
          eyebrow="Full Board"
          title="League Standings"
          description="All active franchise owners ranked by record and league points."
          action={
            <SteelButton href="/picks" size="sm" variant="secondary">
              Make Picks
            </SteelButton>
          }
        />

        <div className="standings-list-v2">
          {standings.map((player, index) => {
            const isTop3 = index < 3;
            const isActivePlayer = player.id === activePlayerId;

            return (
              <SteelCard
                className={`standing-row-v2 ${isTop3 ? "top" : ""} ${
                  isActivePlayer ? "is-active-player" : ""
                }`.trim()}
                key={player.id}
              >
                <div className="standings-rank">
                  <FranchiseLogo
                    nflTeam={player.nflTeamAbbreviation}
                    displayName={player.nflTeamDisplayName}
                    size="sm"
                  />
                  <span>{getRankDisplay(index)}</span>
                  <small>{getRankLabel(index)}</small>
                </div>

                <div className="standings-player">
                  <strong>
                    {player.nflTeamAbbreviation} • {player.name}
                  </strong>
                  <small>
                    {player.division} • vs {player.weeklyOpponentName} •{" "}
                    {formatWeeklyResultLabel(player.weeklyResult)}
                  </small>
                </div>

                <div className="standings-record">
                  <strong>{formatHeadToHeadRecord(player)}</strong>
                  <small>Record</small>
                </div>

                <div className="standings-points">
                  <strong>{player.leaguePoints}</strong>
                  <small>League pts</small>
                </div>

                <div className="standings-pick-score">
                  <strong>
                    {player.pickPoints}/{player.possiblePoints}
                  </strong>
                  <small>Pick score</small>
                </div>

                <SteelBadge variant={getResultBadgeVariant(player.weeklyResult)}>
                  {formatWeeklyResultLabel(player.weeklyResult)}
                </SteelBadge>
              </SteelCard>
            );
          })}

          {standings.length === 0 ? (
            <SteelCard className="standings-empty-card">
              Add franchise owners to build the NFL-style standings board.
            </SteelCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default StandingsBoard;