import { useMemo } from "react";
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

function getResultBadgeVariant(result: string) {
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

function getPlayoffBadgeVariant(status: string) {
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

function getMatchupPlayerBTeam(matchup: HeadToHeadMatchupResult) {
  if (matchup.playerB) {
    return matchup.playerBTeamAbbreviation ?? matchup.playerB.nflTeam;
  }

  if (matchup.matchupType === "open-opponent") {
    return matchup.openOpponentTeamAbbreviation ?? "OPEN";
  }

  return "BYE";
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
    <SteelCard className="standings-playoff-card" as="section">
      <SteelSectionHeader
        eyebrow={`${conference.conference} Playoff Picture`}
        title={`${conference.conference} Seeds`}
        description="Top 4 are division leaders. Seeds 5–7 are wildcard spots. Top seed earns the first-round bye."
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
        slot.isPlaceholder ? "is-placeholder" : ""
      } ${slot.isBye ? "is-bye" : ""}`}
    >
      <div className="standings-bracket-slot-seed">
        <strong>{slot.seed ? `#${slot.seed}` : "—"}</strong>
        <small>{slot.isBye ? "Bye" : "Seed"}</small>
      </div>

      <div className="standings-bracket-slot-main">
        <strong>{slot.label}</strong>
        <small>
          {slot.row
            ? `${slot.row.division} • ${formatHeadToHeadRecord(slot.row)} • ${slot.row.leaguePoints} pts`
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
    <SteelCard className="standings-bracket-card" as="section">
      <SteelSectionHeader
        eyebrow={`${bracket.conference} Bracket`}
        title={`${bracket.conference} Playoff Bracket Shell`}
        description="Bracket layout only. Winners, reseeding, and scoring logic will be wired in later."
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
              <BracketMatchupCard matchup={matchup} key={matchup.id} />
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
              <BracketMatchupCard matchup={matchup} key={matchup.id} />
            ))}
          </div>
        </div>

        <div className="standings-bracket-round-column standings-bracket-round-column--final">
          <div className="standings-bracket-round-title">
            <span>Round 3</span>
            <strong>Championship</strong>
          </div>

          <div className="standings-bracket-matchup-list">
            <BracketMatchupCard matchup={bracket.conferenceChampionship} />
          </div>
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
    <SteelCard className="standings-super-bowl-card" as="section">
      <SteelSectionHeader
        eyebrow="Championship"
        title="Super Bowl Shell"
        description="AFC Champion vs NFC Champion placeholder. Final wiring comes after playoff result logic."
      />

      <div className="standings-super-bowl-matchup">
        <BracketSlotCard slot={matchup.teamA} />

        <div className="standings-super-bowl-center">
          <span>🏆</span>
          <strong>Super Bowl</strong>
          <small>{matchup.matchupLabel}</small>
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
    <main className="standings standings-v2">
      <SteelHero
        eyebrow="NFL-Style Race"
        title="Division Standings"
        subtitle={`Week ${league.currentWeek} playoff-ready standings for Head2Head Brawlin' – Steel Edition.`}
        primaryLabel="Make Picks"
        primaryHref="/picks"
        secondaryLabel="Game Center"
        secondaryHref="/games"
        rightContent={
          <div className="standings-hero-panel">
            <span>Current Top Seed</span>
            <strong>
              {leader
                ? `${leader.nflTeamAbbreviation} • ${leader.name}`
                : "—"}
            </strong>
            <small>
              {leader
                ? `${leader.division} • ${formatHeadToHeadRecord(
                    leader
                  )} • ${leader.leaguePoints} pts`
                : "No results yet"}
            </small>
          </div>
        }
      />

      <section className="standings-stat-grid">
        <SteelStatCard
          label="Franchises"
          value={`${divisionStandings.claimedTeamCount}/${divisionStandings.totalTeamCount}`}
          helper={`${divisionStandings.openTeamCount} teams open`}
          icon="🏟️"
        />

        <SteelStatCard
          label="NFL Schedule"
          value={usingNFLSchedule ? `Week ${nflWeek}` : "Fallback"}
          helper={scheduleHelper}
          icon="📅"
        />

        <SteelStatCard
          label="Playoff Seeds"
          value={`${playoffPicture.totalPlayoffSeeds}/14`}
          helper={`${playoffPicture.totalBubbleTeams} bubble teams`}
          icon="🏆"
        />

        <SteelStatCard
          label="Your Seed"
          value={activePlayoffSeed ? `#${activePlayoffSeed.seed}` : "—"}
          helper={
            activePlayoffSeed
              ? activePlayoffSeed.seedLabel
              : activePlayerStanding
                ? "Outside playoff line"
                : "Select player"
          }
          icon="⭐"
        />
      </section>

      <section className="standings-playoff-stack">
        {playoffPicture.conferences.map((conference) => (
          <PlayoffConferenceCard
            conference={conference}
            key={conference.conference}
          />
        ))}
      </section>

      <section className="standings-bracket-stack">
        {bracketShell.conferences.map((bracket) => (
          <ConferenceBracketCard bracket={bracket} key={bracket.conference} />
        ))}

        <SuperBowlBracketCard matchup={bracketShell.superBowl} />
      </section>

      <SteelCard className="standings-matchups-card" as="section">
        <SteelSectionHeader
          eyebrow="This Week"
          title={`Week ${league.currentWeek} Head-To-Head Matchups`}
          description={
            usingNFLSchedule
              ? "Matchups now mirror the loaded NFL schedule. Open NFL teams show as open opponents."
              : "NFL schedule not loaded yet. Rotation fallback is being used."
          }
        />

        <div className="standings-matchups-grid">
          {weeklyMatchups.map((matchup) => (
            <div className="standings-matchup-item" key={matchup.id}>
              <div className="standings-matchup-player">
                <div>
                  <small>{getMatchupPlayerATeam(matchup)}</small>
                  <strong>{matchup.playerA.name}</strong>
                </div>
                <span>{matchup.playerAScore}</span>
              </div>

              <div className="standings-matchup-center">
                <small>{getMatchupSourceLabel(matchup)}</small>
                <SteelBadge
                  variant={
                    matchup.status === "final"
                      ? "gold"
                      : matchup.status === "bye"
                        ? "neutral"
                        : "neutral"
                  }
                >
                  {matchup.resultLabel}
                </SteelBadge>
              </div>

              <div className="standings-matchup-player is-right">
                <div>
                  <small>{getMatchupPlayerBTeam(matchup)}</small>
                  <strong>{getMatchupOpponentName(matchup)}</strong>
                </div>
                <span>{matchup.playerB ? matchup.playerBScore : "—"}</span>
              </div>
            </div>
          ))}

          {weeklyMatchups.length === 0 ? (
            <p className="standings-muted">No weekly matchups available yet.</p>
          ) : null}
        </div>
      </SteelCard>

      <section className="standings-conference-stack">
        {divisionStandings.conferences.map((conference) => (
          <SteelCard
            className="standings-conference-card"
            as="section"
            key={conference.conference}
          >
            <SteelSectionHeader
              eyebrow={`${conference.conference} Conference`}
              title={`${conference.conference} Division Race`}
              description="Division leaders sit on top. Wildcard-ready tracking is built in for the playoff picture."
            />

            <div className="standings-division-grid">
              {conference.divisions.map((division) => {
                const openTeams = getOpenTeamAbbreviations(division);

                return (
                  <article
                    className="standings-division-card"
                    key={division.division}
                  >
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
                        variant={division.leader ? "gold" : "neutral"}
                      >
                        {division.claimedCount}/4 Claimed
                      </SteelBadge>
                    </div>

                    <div className="standings-division-table">
                      {division.rows.map((player) => (
                        <div
                          className={`standings-division-row ${
                            player.id === activePlayerId
                              ? "is-active-player"
                              : ""
                          }`}
                          key={player.id}
                        >
                          <div className="standings-division-rank">
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
                              player.isDivisionLeader ? "gold" : "neutral"
                            }
                          >
                            {getSeedBadgeLabel(player)}
                          </SteelBadge>
                        </div>
                      ))}

                      {division.rows.length === 0 ? (
                        <p className="standings-muted">
                          No franchise owner in this division yet.
                        </p>
                      ) : null}
                    </div>

                    {openTeams.length > 0 ? (
                      <div className="standings-open-teams">
                        <span>Open teams</span>
                        <strong>{openTeams.join(" • ")}</strong>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </SteelCard>
        ))}
      </section>

      <SteelCard className="standings-podium-card" as="section">
        <SteelSectionHeader
          eyebrow="Top Three"
          title="League Seed Watch"
          description="The current top seeds based on head-to-head league points."
        />

        <div className="standings-podium-grid">
          {standings.slice(0, 3).map((player, index) => (
            <div
              className={`standings-podium-item standings-podium-item--${
                index + 1
              }`}
              key={player.id}
            >
              <span>{getRankDisplay(index)}</span>
              <strong>
                {player.nflTeamAbbreviation} • {player.name}
              </strong>
              <small>
                {player.division} • {formatHeadToHeadRecord(player)} •{" "}
                {player.leaguePoints} pts
              </small>
            </div>
          ))}

          {standings.length === 0 ? (
            <p className="standings-muted">No standings available yet.</p>
          ) : null}
        </div>
      </SteelCard>

      <section className="standings-board-section">
        <SteelSectionHeader
          eyebrow="League Board"
          title={`Week ${league.currentWeek} Overall Rankings`}
          description="Overall head-to-head rankings with each player’s owned NFL franchise."
          action={
            <SteelButton href="/picks" size="sm" variant="secondary">
              Make Picks
            </SteelButton>
          }
        />

        <div className="standings-list standings-list-v2">
          {standings.map((player, index) => {
            const isTop3 = index < 3;
            const isActivePlayer = player.id === activePlayerId;

            return (
              <SteelCard
                as="article"
                className={`standing-row standing-row-v2 ${
                  isTop3 ? "top" : ""
                } ${isActivePlayer ? "is-active-player" : ""}`}
                key={player.id}
              >
                <div className="rank standings-rank">
                  <span>{getRankDisplay(index)}</span>
                  <small>{getRankLabel(index)}</small>
                </div>

                <div className="name standings-player">
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

                <div className="points standings-points">
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
              <p className="standings-muted">
                Add franchise owners to build the NFL-style standings board.
              </p>
            </SteelCard>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default StandingsBoard;