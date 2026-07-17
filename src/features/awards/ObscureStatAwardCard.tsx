import {
  useEffect,
  useState,
} from "react";

import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useObscureStat } from "../../context/ObscureStatContext";
import {
  createObscureStatCoinFlipResolution,
} from "../../engine";
import type {
  ObscureStatAwardCandidate,
  ObscureStatAwardResolutionMethod,
  ObscureStatAwardResult,
  ObscureStatRule,
} from "../../engine";

import "../../styles/obscure-stat-award.css";

type ObscureStatAwardCardProps = {
  className?: string;
  showLeaderboard?: boolean;
  showCoinFlipControls?: boolean;
};

type BadgeVariant =
  | "gold"
  | "success"
  | "danger"
  | "info"
  | "neutral";

function getStatusBadgeVariant(
  result: ObscureStatAwardResult,
): BadgeVariant {
  switch (result.status) {
    case "resolved":
      return "success";

    case "coin-flip-required":
      return "gold";

    case "unavailable":
      return "danger";

    case "pending":
      return "info";

    case "no-award":
    default:
      return "neutral";
  }
}

function getStatusLabel(
  result: ObscureStatAwardResult,
): string {
  switch (result.status) {
    case "resolved":
      return "Winner Finalized";

    case "coin-flip-required":
      return "Coin Flip Required";

    case "unavailable":
      return "Data Unavailable";

    case "pending":
      return "Pending";

    case "no-award":
    default:
      return "No Award";
  }
}

function getDirectionLabel(
  rule: ObscureStatRule,
): string {
  if (rule.direction === "highest") {
    return "Highest value wins";
  }

  if (rule.direction === "lowest") {
    return "Lowest value wins";
  }

  return "No competition";
}

function formatStatValue(
  value: number | null,
  rule: ObscureStatRule,
): string {
  if (
    value === null ||
    !Number.isFinite(value)
  ) {
    return "—";
  }

  switch (rule.valueUnit) {
    case "seconds": {
      const totalSeconds = Math.max(
        0,
        Math.round(value),
      );

      const minutes = Math.floor(
        totalSeconds / 60,
      );

      const seconds =
        totalSeconds % 60;

      return `${minutes}:${String(
        seconds,
      ).padStart(2, "0")}`;
    }

    case "plays":
      return `${Math.round(value)} plays`;

    case "ratio":
    default:
      return value.toFixed(
        rule.displayDecimals,
      );
  }
}

function getResolutionMethodLabel(
  method:
    | ObscureStatAwardResolutionMethod
    | undefined,
): string {
  switch (method) {
    case "stat-value":
      return "Won on obscure-stat value";

    case "weekly-correct-picks":
      return "Weekly correct-picks tiebreak";

    case "league-points":
      return "Standings-points tiebreak";

    case "assigned-nfl-team-win":
      return "Assigned NFL team win tiebreak";

    case "offline-coin-flip":
      return "Offline coin flip";

    default:
      return "Official result";
  }
}

function getCandidateStatusLabel(
  candidate: ObscureStatAwardCandidate,
): string {
  switch (candidate.eligibility) {
    case "eligible":
      return "Eligible";

    case "no-weekly-game":
      return "No weekly game";

    case "game-not-final":
      return "Game not final";

    case "stat-unavailable":
    default:
      return "Stat unavailable";
  }
}

function getPendingMessage(
  result: ObscureStatAwardResult,
): {
  title: string;
  detail: string;
} {
  if (
    result.pendingReason ===
    "weekly-scoring-not-final"
  ) {
    return {
      title: "Waiting for weekly scoring",
      detail:
        "NFL team statistics are available, but the week must be finalized before pick-based tiebreakers can be applied.",
    };
  }

  return {
    title:
      "Waiting for final NFL statistics",
    detail:
      "The award will be calculated after every required NFL game for this week is final.",
  };
}

function getActionErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to save the offline coin-flip winner.";
}

function ObscureStatCandidateRow({
  candidate,
  rule,
}: {
  candidate: ObscureStatAwardCandidate;
  rule: ObscureStatRule;
}) {
  const { league } = useLeague();

  const player = league.players.find(
    (leaguePlayer) =>
      leaguePlayer.id ===
      candidate.playerId,
  );

  return (
    <article
      className={`obscure-stat-candidate ${
        candidate.primaryRank === 1
          ? "is-leader"
          : ""
      }`.trim()}
    >
      <div className="obscure-stat-candidate-rank">
        {candidate.primaryRank !== null
          ? `#${candidate.primaryRank}`
          : "—"}
      </div>

      <FranchiseLogo
        nflTeam={candidate.nflTeam}
        customLogo={player?.customLogo}
        displayName={
          candidate.playerName
        }
        size="sm"
        variant="tile"
      />

      <div className="obscure-stat-candidate-identity">
        <strong>
          {candidate.playerName}
        </strong>

        <span>
          {candidate.nflTeam}
          {candidate.opponentNFLTeam
            ? ` vs. ${candidate.opponentNFLTeam}`
            : ""}
        </span>
      </div>

      <div className="obscure-stat-candidate-value">
        <strong>
          {formatStatValue(
            candidate.statValue,
            rule,
          )}
        </strong>

        <span>
          {getCandidateStatusLabel(
            candidate,
          )}
        </span>
      </div>

      <div className="obscure-stat-candidate-tiebreakers">
        <span>
          Picks{" "}
          <strong>
            {candidate.weeklyCorrectPicks ??
              "—"}
          </strong>
        </span>

        <span>
          Points{" "}
          <strong>
            {candidate.leaguePoints}
          </strong>
        </span>

        <span>
          NFL Team{" "}
          <strong>
            {candidate.assignedNFLTeamWon ===
            true
              ? "Won"
              : candidate.assignedNFLTeamWon ===
                  false
                ? "Lost"
                : "—"}
          </strong>
        </span>
      </div>
    </article>
  );
}

function ObscureStatAwardCard({
  className = "",
  showLeaderboard = false,
  showCoinFlipControls = false,
}: ObscureStatAwardCardProps) {
  const {
    league,
    upsertObscureStatCoinFlipResolution,
    clearObscureStatCoinFlipResolution,
  } = useLeague();

  const {
    rule,
    baseResult,
    result,
    coinFlipResolution,
    loading,
    error,
    refresh,
  } = useObscureStat();

  const coinFlipCandidates =
    baseResult.candidates.filter(
      (candidate) =>
        baseResult.coinFlipPlayerIds.includes(
          candidate.playerId,
        ),
    );

  const defaultCoinFlipWinnerId =
    coinFlipResolution?.winnerPlayerId ??
    coinFlipCandidates[0]?.playerId ??
    "";

  const [
    selectedCoinFlipWinnerId,
    setSelectedCoinFlipWinnerId,
  ] = useState(
    defaultCoinFlipWinnerId,
  );

  const [
    coinFlipActionError,
    setCoinFlipActionError,
  ] = useState<string | null>(null);

  useEffect(() => {
    setSelectedCoinFlipWinnerId(
      defaultCoinFlipWinnerId,
    );

    setCoinFlipActionError(null);
  }, [
    defaultCoinFlipWinnerId,
    baseResult.id,
  ]);

  const winnerPlayer =
    result.winner
      ? league.players.find(
          (player) =>
            player.id ===
            result.winner?.playerId,
        )
      : null;

  const savedCoinFlipWinner =
    coinFlipCandidates.find(
      (candidate) =>
        candidate.playerId ===
        coinFlipResolution
          ?.winnerPlayerId,
    );

  const pendingMessage =
    getPendingMessage(result);

  const shouldShowCoinFlipPanel =
    baseResult.status ===
      "coin-flip-required" &&
    (
      showCoinFlipControls ||
      result.status ===
        "coin-flip-required"
    );

  const classes = [
    "obscure-stat-award-card",
    `obscure-stat-award-card--${result.status}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const recordCoinFlipWinner = () => {
    setCoinFlipActionError(null);

    try {
      const resolution =
        createObscureStatCoinFlipResolution({
          result: baseResult,

          winnerPlayerId:
            selectedCoinFlipWinnerId,
        });

      upsertObscureStatCoinFlipResolution(
        resolution,
      );
    } catch (actionError) {
      setCoinFlipActionError(
        getActionErrorMessage(
          actionError,
        ),
      );
    }
  };

  const clearCoinFlipWinner = () => {
    if (!coinFlipResolution) {
      return;
    }

    clearObscureStatCoinFlipResolution(
      coinFlipResolution.id,
    );

    setSelectedCoinFlipWinnerId(
      coinFlipCandidates[0]
        ?.playerId ?? "",
    );

    setCoinFlipActionError(null);
  };

  return (
    
<details className="app-collapsible-panel" data-collapsible-panel>
  <summary className="app-collapsible__summary">
    <span className="app-collapsible__title">Weekly Obscure Stat</span>
    <span className="app-collapsible__state">
      <span className="app-collapsible__open">Open</span>
      <span className="app-collapsible__close">Close</span>
    </span>
  </summary>
  <div className="app-collapsible__content">
<SteelCard
      className={classes}
      as="section"
      variant={
        result.status === "resolved"
          ? "gold"
          : result.status ===
              "unavailable"
            ? "danger"
            : "default"
      }
    >
      <SteelSectionHeader
        eyebrow={`Week ${result.week} • $${rule.payoutDollars} Award`}
        title="Weekly Obscure Stat"
        description={
          rule.status === "active"
            ? `${rule.label} • ${getDirectionLabel(
                rule,
              )}`
            : "This week has no obscure-stat competition or payout."
        }
        action={
          <SteelBadge
            variant={getStatusBadgeVariant(
              result,
            )}
          >
            {getStatusLabel(result)}
          </SteelBadge>
        }
      />

      <div className="obscure-stat-rule-summary">
        <div>
          <span>Selected Stat</span>

          <strong>{rule.label}</strong>
        </div>

        <div>
          <span>Winning Direction</span>

          <strong>
            {rule.direction
              ? rule.direction ===
                "highest"
                ? "Highest"
                : "Lowest"
              : "—"}
          </strong>
        </div>

        <div>
          <span>Payout</span>

          <strong>
            {rule.payoutDollars > 0
              ? `$${rule.payoutDollars}`
              : "No payout"}
          </strong>
        </div>
      </div>

      {result.status === "no-award" ? (
        <div className="obscure-stat-state-panel is-no-award">
          <div className="obscure-stat-state-icon">
            —
          </div>

          <div>
            <strong>
              No obscure-stat award this
              week
            </strong>

            <p>
              The scheduled award returns
              on the next active
              obscure-stat week.
            </p>
          </div>
        </div>
      ) : null}

      {result.status === "pending" ? (
        <div className="obscure-stat-state-panel">
          <div className="obscure-stat-state-icon">
            {loading ? "↻" : "⏳"}
          </div>

          <div>
            <strong>
              {loading
                ? "Loading NFL team statistics"
                : pendingMessage.title}
            </strong>

            <p>
              {loading
                ? "Retrieving completed game box scores from the NFL data provider."
                : pendingMessage.detail}
            </p>
          </div>
        </div>
      ) : null}

      {result.status ===
      "unavailable" ? (
        <div className="obscure-stat-state-panel is-error">
          <div className="obscure-stat-state-icon">
            !
          </div>

          <div>
            <strong>
              Award data is unavailable
            </strong>

            <p>
              One or more required team
              statistics could not be
              calculated.
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          className="obscure-stat-error"
          role="alert"
        >
          <div>
            <strong>
              NFL statistics request failed
            </strong>

            <p>{error}</p>
          </div>

          <SteelButton
            disabled={loading}
            onClick={() => {
              void refresh();
            }}
            size="sm"
            variant="secondary"
          >
            {loading
              ? "Retrying..."
              : "Retry"}
          </SteelButton>
        </div>
      ) : null}

      {result.status === "resolved" &&
      result.winner ? (
        <div className="obscure-stat-winner">
          <FranchiseLogo
            nflTeam={
              result.winner.nflTeam
            }
            customLogo={
              winnerPlayer?.customLogo
            }
            displayName={
              result.winner.playerName
            }
            size="xl"
            variant="tile"
          />

          <div className="obscure-stat-winner-identity">
            <span>
              Official Week {result.week}{" "}
              Winner
            </span>

            <strong>
              {result.winner.playerName}
            </strong>

            <small>
              {result.winner.nflTeam} vs.{" "}
              {
                result.winner
                  .opponentNFLTeam
              }
            </small>

            <em>
              {getResolutionMethodLabel(
                result.winner
                  .resolutionMethod,
              )}
            </em>
          </div>

          <div className="obscure-stat-winning-value">
            <strong>
              {formatStatValue(
                result.winner.statValue,
                rule,
              )}
            </strong>

            <span>{rule.label}</span>
          </div>
        </div>
      ) : null}

      {shouldShowCoinFlipPanel ? (
        <div className="obscure-stat-coin-flip">
          <div className="obscure-stat-state-icon">
            🪙
          </div>

          <div className="obscure-stat-coin-flip-body">
            <strong>
              {coinFlipResolution
                ? "Offline coin flip winner recorded"
                : "Offline coin flip required"}
            </strong>

            <p>
              {coinFlipResolution &&
              savedCoinFlipWinner
                ? `${savedCoinFlipWinner.playerName} is currently recorded as the offline coin-flip winner.`
                : "The obscure stat, weekly correct picks, standings points, and assigned NFL team result are still tied."}
            </p>

            <div className="obscure-stat-coin-flip-players">
              {coinFlipCandidates.map(
                (candidate) => (
                  <span
                    key={
                      candidate.playerId
                    }
                    className={
                      candidate.playerId ===
                      coinFlipResolution
                        ?.winnerPlayerId
                        ? "is-selected"
                        : ""
                    }
                  >
                    {candidate.playerName}
                  </span>
                ),
              )}
            </div>

            {showCoinFlipControls ? (
              <div className="obscure-stat-coin-flip-controls">
                <label
                  htmlFor={`obscure-stat-coin-flip-winner-${result.week}`}
                >
                  <span>
                    Offline Coin Flip Winner
                  </span>

                  <select
                    id={`obscure-stat-coin-flip-winner-${result.week}`}
                    name={`obscure-stat-coin-flip-winner-${result.week}`}
                    value={
                      selectedCoinFlipWinnerId
                    }
                    onChange={(event) => {
                      setSelectedCoinFlipWinnerId(
                        event.target.value,
                      );

                      setCoinFlipActionError(
                        null,
                      );
                    }}
                  >
                    {coinFlipCandidates.map(
                      (candidate) => (
                        <option
                          key={
                            candidate.playerId
                          }
                          value={
                            candidate.playerId
                          }
                        >
                          {
                            candidate.playerName
                          }{" "}
                          —{" "}
                          {
                            candidate.nflTeam
                          }
                        </option>
                      ),
                    )}
                  </select>

                  <small>
                    Conduct the coin flip
                    offline, then record the
                    winner here.
                  </small>
                </label>

                <div className="obscure-stat-coin-flip-actions">
                  <SteelButton
                    disabled={
                      !selectedCoinFlipWinnerId
                    }
                    onClick={
                      recordCoinFlipWinner
                    }
                    size="sm"
                    variant="primary"
                  >
                    {coinFlipResolution
                      ? "Update Winner"
                      : "Record Winner"}
                  </SteelButton>

                  {coinFlipResolution ? (
                    <SteelButton
                      onClick={
                        clearCoinFlipWinner
                      }
                      size="sm"
                      variant="danger"
                    >
                      Clear Decision
                    </SteelButton>
                  ) : null}
                </div>

                {coinFlipActionError ? (
                  <p
                    className="obscure-stat-coin-flip-action-error"
                    role="alert"
                  >
                    {coinFlipActionError}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showLeaderboard &&
      result.candidates.length > 0 &&
      rule.status === "active" ? (
        <div className="obscure-stat-leaderboard">
          <div className="obscure-stat-leaderboard-heading">
            <div>
              <span>
                Weekly Team Stat Results
              </span>

              <strong>
                {result.eligiblePlayerCount}{" "}
                eligible players
              </strong>
            </div>

            <SteelBadge variant="neutral">
              {getDirectionLabel(rule)}
            </SteelBadge>
          </div>

          <div className="obscure-stat-candidate-list">
            {result.candidates.map(
              (candidate) => (
                <ObscureStatCandidateRow
                  key={candidate.playerId}
                  candidate={candidate}
                  rule={rule}
                />
              ),
            )}
          </div>
        </div>
      ) : null}

      <div className="obscure-stat-award-footer">
        <div>
          <span>Eligible Players</span>

          <strong>
            {result.eligiblePlayerCount}
          </strong>
        </div>

        <div>
          <span>Unavailable</span>

          <strong>
            {
              result.unavailablePlayerCount
            }
          </strong>
        </div>

        <div>
          <span>Weekly Scoring</span>

          <strong>
            {result.weeklyScoringFinalized
              ? "Final"
              : "Pending"}
          </strong>
        </div>

        <div>
          <span>NFL Statistics</span>

          <strong>
            {result.allRequiredGameStatsFinal
              ? "Final"
              : "Pending"}
          </strong>
        </div>
      </div>
    </SteelCard>
  </div>
</details>
  );
}

export default ObscureStatAwardCard;