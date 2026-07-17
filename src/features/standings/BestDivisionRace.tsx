import { useMemo } from "react";
import {
  SteelBadge,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildEffectiveHeadToHeadPicks,
  buildSeasonAwareNFLStyleDivisionStandings,
} from "../../engine";
import "../../styles/bestDivisionRace.css";

type DivisionRaceRow = {
  conference: string;
  division: string;
  playerNames: string[];
  leaguePoints: number;
  wins: number;
  losses: number;
  ties: number;
  pickPoints: number;
  isActiveDivision: boolean;
};

type RankedDivisionRaceRow =
  DivisionRaceRow & {
    rank: number;
    isLeader: boolean;
  };

function formatCombinedRecord(
  row: DivisionRaceRow,
) {
  return `${row.wins}-${row.losses}-${row.ties}`;
}

function BestDivisionRace() {
  const {
    league,
    picks,
    gameResults,
    scoringHistory,
    pickerClickerHistory,
    activePlayerId,
  } = useLeague();

  const {
    season,
    snapshot,
  } = useNFL();

  const nflGames = useMemo(
    () => snapshot?.nflGames ?? [],
    [snapshot],
  );

  const allPicks = useMemo(
    () =>
      league.players.reduce<
        Record<
          string,
          Record<string, string>
        >
      >((playerPicks, player) => {
        playerPicks[player.id] =
          picks[player.id] || {};

        return playerPicks;
      }, {}),
    [league.players, picks],
  );

  const effectiveAllPicks = useMemo(
    () =>
      buildEffectiveHeadToHeadPicks({
        picks: allPicks,
        pickerClickerHistory,
        season,
        throughWeek:
          league.currentWeek,
      }),
    [
      allPicks,
      pickerClickerHistory,
      season,
      league.currentWeek,
    ],
  );

  const divisionStandings = useMemo(
    () =>
      buildSeasonAwareNFLStyleDivisionStandings(
        {
          players: league.players,
          picks: effectiveAllPicks,
          gameResults,
          scoringHistory,
          nflGames,
          season,
          week: league.currentWeek,
        },
      ),
    [
      league.players,
      effectiveAllPicks,
      gameResults,
      scoringHistory,
      nflGames,
      season,
      league.currentWeek,
    ],
  );

  const rankedDivisions =
    useMemo<RankedDivisionRaceRow[]>(() => {
      const divisionRows =
        divisionStandings.conferences.flatMap(
          (conference) =>
            conference.divisions.map(
              (division): DivisionRaceRow => {
                const totals =
                  division.rows.reduce(
                    (result, player) => {
                      result.leaguePoints +=
                        player.leaguePoints;
                      result.wins +=
                        player.wins;
                      result.losses +=
                        player.losses;
                      result.ties +=
                        player.ties;
                      result.pickPoints +=
                        player.pickPoints;

                      return result;
                    },
                    {
                      leaguePoints: 0,
                      wins: 0,
                      losses: 0,
                      ties: 0,
                      pickPoints: 0,
                    },
                  );

                return {
                  conference:
                    conference.conference,
                  division:
                    division.division,
                  playerNames:
                    division.rows.map(
                      (player) =>
                        player.name,
                    ),
                  ...totals,
                  isActiveDivision:
                    division.rows.some(
                      (player) =>
                        player.id ===
                        activePlayerId,
                    ),
                };
              },
            ),
        );

      divisionRows.sort(
        (left, right) =>
          right.leaguePoints -
            left.leaguePoints ||
          right.wins - left.wins ||
          right.pickPoints -
            left.pickPoints ||
          left.losses - right.losses ||
          left.division.localeCompare(
            right.division,
          ),
      );

      const leadingPoints =
        divisionRows[0]?.leaguePoints ??
        0;

      let previousPointTotal:
        | number
        | null = null;

      let previousRank = 0;

      return divisionRows.map(
        (division, index) => {
          if (
            division.leaguePoints !==
            previousPointTotal
          ) {
            previousRank = index + 1;
            previousPointTotal =
              division.leaguePoints;
          }

          return {
            ...division,
            rank: previousRank,
            isLeader:
              division.leaguePoints ===
              leadingPoints,
          };
        },
      );
    }, [
      divisionStandings,
      activePlayerId,
    ]);

  const leadingDivisions =
    rankedDivisions.filter(
      (division) => division.isLeader,
    );

  const leadingPoints =
    leadingDivisions[0]?.leaguePoints ??
    0;

  const leaderLabel =
    leadingDivisions.length === 1
      ? leadingDivisions[0].division
      : `${leadingDivisions.length}-way tie`;

  const leaderBadge =
    leadingDivisions.length === 1
      ? "Current Leader"
      : "Tied Lead";

  return (
    
<details className="app-collapsible-panel" data-collapsible-panel>
  <summary className="app-collapsible__summary">
    <span className="app-collapsible__title">Best Division Race</span>
    <span className="app-collapsible__state">
      <span className="app-collapsible__open">Open</span>
      <span className="app-collapsible__close">Close</span>
    </span>
  </summary>
  <div className="app-collapsible__content">
<SteelCard className="best-division-race">
      <SteelSectionHeader
        eyebrow={`2026 Best Division • Week ${league.currentWeek}`}
        title="Best Division Race"
        description="Division score is the combined league points earned by all four players. Equal point totals remain tied."
        action={
          <SteelBadge
            variant={
              leadingDivisions.length ===
              1
                ? "gold"
                : "info"
            }
          >
            {leaderBadge}
          </SteelBadge>
        }
      />

      <section className="best-division-race__summary">
        <div>
          <span>Current leader</span>
          <strong>{leaderLabel}</strong>
          <small>
            {leadingPoints} combined league
            point
            {leadingPoints === 1
              ? ""
              : "s"}
          </small>
        </div>

        <div>
          <span>Division award</span>
          <strong>$48 total</strong>
          <small>$12 per player</small>
        </div>
      </section>

      <div className="best-division-race__grid">
        {rankedDivisions.map(
          (division) => (
            <article
              key={division.division}
              className={[
                "best-division-race__row",
                division.isLeader
                  ? "is-leader"
                  : "",
                division.isActiveDivision
                  ? "is-active-division"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="best-division-race__topline">
                <span>
                  #{division.rank}
                </span>

                <div>
                  <strong>
                    {division.division}
                  </strong>

                  <small>
                    {division.conference}
                  </small>
                </div>

                {division.isLeader ? (
                  <SteelBadge variant="gold">
                    {leadingDivisions.length >
                    1
                      ? "Tied"
                      : "Leader"}
                  </SteelBadge>
                ) : null}
              </div>

              <div className="best-division-race__stats">
                <div>
                  <span>
                    League points
                  </span>
                  <strong>
                    {
                      division.leaguePoints
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Combined record
                  </span>
                  <strong>
                    {formatCombinedRecord(
                      division,
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Pick points
                  </span>
                  <strong>
                    {division.pickPoints}
                  </strong>
                </div>
              </div>

              <p>
                {division.playerNames.length >
                0
                  ? division.playerNames.join(
                      " • ",
                    )
                  : "No active players"}
              </p>

              {division.isActiveDivision ? (
                <small className="best-division-race__active-note">
                  Your division
                </small>
              ) : null}
            </article>
          ),
        )}
      </div>
    </SteelCard>
  </div>
</details>
  );
}

export default BestDivisionRace;
