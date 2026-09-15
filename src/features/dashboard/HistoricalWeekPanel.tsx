import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  SteelBadge,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import {
  getEffectivePlayerPick,
  getPickerClickerWeekId,
  getWeeklyScoringRecordId,
} from "../../engine";
import {
  loadCloudLeagueGames,
  type CloudLeagueGame,
} from "../../services/cloudLeagueGameService";
import {
  loadCloudOpponentPickReveal,
  type CloudOpponentPickReveal,
} from "../../services/cloudOpponentPickRevealService";
import {
  loadCloudPlayerPickIntents,
  type CloudPlayerPickIntent,
} from "../../services/cloudPlayerPickService";
import { supabaseClient } from "../../services/supabaseClient";

function formatKickoff(value: string): string {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    },
  ).format(new Date(timestamp));
}

function getOutcomeVariant(
  outcome: string | undefined,
):
  | "success"
  | "danger"
  | "gold"
  | "neutral" {
  if (outcome === "win") {
    return "success";
  }

  if (outcome === "loss") {
    return "danger";
  }

  if (outcome === "tie") {
    return "gold";
  }

  return "neutral";
}

function getOutcomeLabel(
  outcome: string | undefined,
): string {
  if (!outcome) {
    return "Final";
  }

  if (outcome === "win") {
    return "Win";
  }

  if (outcome === "loss") {
    return "Loss";
  }

  if (outcome === "tie") {
    return "Tie";
  }

  if (outcome === "bye") {
    return "Bye";
  }

  if (outcome === "open") {
    return "Open Team";
  }

  return outcome;
}

function buildManualPickMap(
  playerId: string,
  intents: CloudPlayerPickIntent[],
) {
  return {
    [playerId]:
      intents.reduce<Record<string, string>>(
        (result, intent) => {
          if (intent.selectedTeam) {
            result[intent.gameId] =
              intent.selectedTeam;
          }

          return result;
        },
        {},
      ),
  };
}

function HistoricalWeekPanel({
  week,
}: {
  week: number;
}) {
  const {
    status,
    accountLink,
  } = useAuth();

  const {
    league,
    activePlayerId,
    pickerClickerHistory,
    scoringHistory,
  } = useLeague();

  const season = Number.parseInt(
    String(league.settings.season),
    10,
  );

  const selectedPlayerId =
    activePlayerId ||
    accountLink?.playerId ||
    "";

  const isCommissioner = Boolean(
    accountLink &&
      (
        accountLink.role ===
          "commissioner" ||
        accountLink.role ===
          "backup_commissioner"
      ),
  );

  const canView = Boolean(
    status === "signed-in-linked" &&
      accountLink &&
      selectedPlayerId &&
      (
        selectedPlayerId ===
          accountLink.playerId ||
        isCommissioner
      ),
  );

  const scoringRecord =
    scoringHistory[
      getWeeklyScoringRecordId(
        season,
        week,
      )
    ];

  const playerResult =
    scoringRecord?.playerResults[
      selectedPlayerId
    ];

  const playerMatchup =
    scoringRecord?.matchups.find(
      (matchup) =>
        matchup.playerAId ===
          selectedPlayerId ||
        matchup.playerBId ===
          selectedPlayerId,
    );

  const [
    games,
    setGames,
  ] = useState<CloudLeagueGame[]>([]);

  const [
    ownIntents,
    setOwnIntents,
  ] = useState<
    CloudPlayerPickIntent[]
  >([]);

  const [
    reveal,
    setReveal,
  ] =
    useState<
      CloudOpponentPickReveal | null
    >(null);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(null);

  useEffect(() => {
    const client = supabaseClient;

    if (
      !client ||
      !accountLink ||
      !canView
    ) {
      setGames([]);
      setOwnIntents([]);
      setReveal(null);
      return;
    }

    let canceled = false;

    setLoading(true);
    setMessage(null);

    void Promise.all([
      loadCloudLeagueGames(
        client,
        accountLink.leagueId,
        season,
        week,
      ),

      loadCloudPlayerPickIntents(
        client,
        accountLink.leagueId,
        selectedPlayerId,
        week,
      ),

      loadCloudOpponentPickReveal(
        client,
        {
          leagueId:
            accountLink.leagueId,
          playerId:
            selectedPlayerId,
          week,
        },
      ),
    ])
      .then(
        ([
          nextGames,
          nextOwnIntents,
          nextReveal,
        ]) => {
          if (canceled) {
            return;
          }

          setGames(nextGames);
          setOwnIntents(
            nextOwnIntents,
          );
          setReveal(nextReveal);
        },
      )
      .catch((error) => {
        if (canceled) {
          return;
        }

        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load this past week.",
        );
      })
      .finally(() => {
        if (!canceled) {
          setLoading(false);
        }
      });

    return () => {
      canceled = true;
    };
  }, [
    accountLink,
    canView,
    season,
    selectedPlayerId,
    week,
  ]);

  const weekState =
    pickerClickerHistory[
      getPickerClickerWeekId(
        season,
        week,
      )
    ] ?? null;

  const ownPickMap = useMemo(
    () =>
      buildManualPickMap(
        selectedPlayerId,
        ownIntents,
      ),
    [
      ownIntents,
      selectedPlayerId,
    ],
  );

  const ownIntentByGame =
    useMemo(
      () =>
        new Map(
          ownIntents.map(
            (intent) => [
              intent.gameId,
              intent,
            ],
          ),
        ),
      [ownIntents],
    );

  const opponentByGame =
    useMemo(
      () =>
        new Map(
          (
            reveal?.revealedPicks ??
            []
          ).map(
            (pick) => [
              pick.gameId,
              pick,
            ],
          ),
        ),
      [reveal],
    );

  if (!canView) {
    return (
      <SteelCard variant="gold">
        <SteelSectionHeader
          eyebrow={`Week ${week} History`}
          title="Past Week"
          description="Sign in with your linked player account to view historical picks."
        />
      </SteelCard>
    );
  }

  return (
    <>
      <SteelCard
        className="opponent-reveal-card"
        variant="gold"
      >
        <SteelSectionHeader
          eyebrow={`Season ${season} • Week ${week} • Read Only`}
          title="Past Week Review"
          description="Finalized picks and results are shown for review only. Nothing on this screen can change a saved pick."
          action={
            <SteelBadge
              variant={getOutcomeVariant(
                playerResult?.outcome,
              )}
            >
              {getOutcomeLabel(
                playerResult?.outcome,
              )}
            </SteelBadge>
          }
        />

        <div className="opponent-reveal-matchup">
          <div>
            <span>My result</span>

            <strong>
              {playerResult?.playerName ??
                "Player"}
            </strong>

            <small>
              {playerResult
                ? `${playerResult.correctPicks} correct • ${playerResult.leaguePointsAwarded} pts`
                : "Finalized result unavailable"}
            </small>
          </div>

          <div
            aria-hidden="true"
            className="opponent-reveal-versus"
          >
            VS
          </div>

          <div>
            <span>Week opponent</span>

            <strong>
              {playerResult?.opponentName ??
                reveal?.opponentPlayerName ??
                "No opponent"}
            </strong>

            <small>
              {playerMatchup
                ? playerMatchup.resultLabel
                : "Finalized matchup"}
            </small>
          </div>
        </div>

        {message ? (
          <p className="opponent-reveal-message">
            {message}
          </p>
        ) : null}

        <div className="pick-comparison">
          <div className="pick-comparison-heading">
            <span>Game</span>
            <strong>My Picks</strong>
            <strong>
              Opponent Picks
            </strong>
          </div>

          {games.map((game) => {
            const effectiveOwnPick =
              weekState
                ? getEffectivePlayerPick(
                    {
                      playerId:
                        selectedPlayerId,
                      gameId:
                        game.gameId,
                      picks:
                        ownPickMap,
                      weekState,
                    },
                  )
                : null;

            const ownIntent =
              ownIntentByGame.get(
                game.gameId,
              );

            const opponentPick =
              opponentByGame.get(
                game.gameId,
              );

            const ownTeam =
              effectiveOwnPick?.team ??
              ownIntent?.selectedTeam ??
              null;

            let ownLabel =
              "No pick recorded";

            if (ownTeam) {
              ownLabel =
                effectiveOwnPick &&
                effectiveOwnPick.source !==
                  "manual"
                  ? `Picker Clicker → ${ownTeam}`
                  : ownTeam;
            } else if (
              ownIntent?.choice ===
              "picker-clicker"
            ) {
              ownLabel =
                "Picker Clicker";
            }

            let opponentLabel =
              "No pick recorded";

            if (
              opponentPick?.effectiveTeam
            ) {
              opponentLabel =
                opponentPick.intentType ===
                "manual"
                  ? opponentPick.effectiveTeam
                  : `Picker Clicker → ${opponentPick.effectiveTeam}`;
            } else if (
              reveal?.matchupType ===
              "bye"
            ) {
              opponentLabel =
                "Bye — no opponent";
            } else if (
              reveal?.matchupType ===
              "open-opponent"
            ) {
              opponentLabel =
                "Open team — no entry";
            }

            const picksDiffer =
              Boolean(
                ownTeam &&
                  opponentPick?.effectiveTeam &&
                  ownTeam !==
                    opponentPick.effectiveTeam,
              );

            return (
              <article
                className="pick-comparison-row"
                key={game.gameId}
              >
                <div className="pick-comparison-game">
                  <strong>
                    {game.awayTeam} @{" "}
                    {game.homeTeam}
                  </strong>

                  <small>
                    {formatKickoff(
                      game.kickoffAt,
                    )}

                    {game.status ===
                      "final" &&
                    game.awayScore !==
                      null &&
                    game.homeScore !==
                      null
                      ? ` • ${game.awayScore}-${game.homeScore}`
                      : ""}
                  </small>
                </div>

                <div>
                  <span className="pick-comparison-mobile-label">
                    My Picks
                  </span>

                  <strong
                    className={
                      picksDiffer
                        ? "pick-comparison-different"
                        : undefined
                    }
                  >
                    {ownLabel}
                  </strong>
                </div>

                <div>
                  <span className="pick-comparison-mobile-label">
                    Opponent Picks
                  </span>

                  <strong
                    className={
                      picksDiffer
                        ? "pick-comparison-different"
                        : undefined
                    }
                  >
                    {opponentLabel}
                  </strong>
                </div>
              </article>
            );
          })}

          {loading ? (
            <p className="opponent-reveal-waiting">
              Loading finalized Week{" "}
              {week} picks…
            </p>
          ) : null}

          {!loading &&
          games.length === 0 ? (
            <p className="opponent-reveal-waiting">
              No saved games were found
              for Week {week}.
            </p>
          ) : null}
        </div>
      </SteelCard>

      {scoringRecord ? (
        <SteelCard className="standings-matchups-card">
          <SteelSectionHeader
            eyebrow={`Week ${week} Final`}
            title="Head-to-Head Matchups"
            description="Finalized results for the entire league."
          />

          <div className="pick-comparison">
            <div className="pick-comparison-heading">
              <span>Matchup</span>
              <strong>Score</strong>
              <strong>Result</strong>
            </div>

            {scoringRecord.matchups.map(
              (matchup) => (
                <article
                  className="pick-comparison-row"
                  key={matchup.id}
                >
                  <div className="pick-comparison-game">
                    <strong>
                      {matchup.playerAName}
                      {" vs "}
                      {matchup.playerBName ??
                        "Open"}
                    </strong>

                    <small>
                      {matchup.playerATeam}

                      {matchup.playerBTeam
                        ? ` vs ${matchup.playerBTeam}`
                        : ""}
                    </small>
                  </div>

                  <div>
                    <span className="pick-comparison-mobile-label">
                      Score
                    </span>

                    <strong>
                      {
                        matchup.playerAScore
                      }

                      {matchup.playerBId
                        ? ` - ${matchup.playerBScore}`
                        : ""}
                    </strong>
                  </div>

                  <div>
                    <span className="pick-comparison-mobile-label">
                      Result
                    </span>

                    <strong>
                      {
                        matchup.resultLabel
                      }
                    </strong>
                  </div>
                </article>
              ),
            )}
          </div>
        </SteelCard>
      ) : (
        <SteelCard>
          <p className="opponent-reveal-waiting">
            Finalized Week {week} scoring
            is not available yet.
          </p>
        </SteelCard>
      )}
    </>
  );
}

export default HistoricalWeekPanel;
