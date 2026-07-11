import {
  useEffect,
  useState,
} from "react";

import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import { useSeasonAwards } from "../../context/SeasonAwardContext";
import {
  PAYOUT_LEDGER_AMOUNTS_CENTS,
  SEASON_AWARD_CATEGORIES,
  type SeasonAwardCandidate,
  type SeasonAwardCategory,
  type SeasonAwardResolutionMethod,
  type SeasonAwardResult,
} from "../../engine";

import "../../styles/season-awards.css";

type SeasonAwardsBoardProps = {
  showCoinFlipControls?: boolean;
};

const CATEGORY_DESCRIPTIONS: Record<
  SeasonAwardCategory,
  string
> = {
  "biggest-winner":
    "Most regular-season head-to-head wins.",
  "biggest-loser":
    "Most regular-season head-to-head losses.",
  "last-to-lose":
    "Player whose first head-to-head loss occurred latest.",
};

const CATEGORY_PAYOUTS_CENTS: Record<
  SeasonAwardCategory,
  number
> = {
  "biggest-winner":
    PAYOUT_LEDGER_AMOUNTS_CENTS.biggestWinner,
  "biggest-loser":
    PAYOUT_LEDGER_AMOUNTS_CENTS.biggestLoser,
  "last-to-lose":
    PAYOUT_LEDGER_AMOUNTS_CENTS.lastToLose,
};

const moneyFormatter =
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

function formatMoney(
  amountCents: number,
): string {
  return moneyFormatter.format(
    amountCents / 100,
  );
}

function getStatusLabel(
  result: SeasonAwardResult,
): string {
  switch (result.status) {
    case "resolved":
      return "Winner Finalized";
    case "coin-flip-required":
      return "Coin Flip Required";
    case "provisional":
      return "Provisional";
    case "unavailable":
    default:
      return "Unavailable";
  }
}

function getStatusClass(
  result: SeasonAwardResult,
): string {
  return `season-award-status season-award-status--${result.status}`;
}

function getResolutionMethodLabel(
  method:
    | SeasonAwardResolutionMethod
    | undefined,
): string {
  switch (method) {
    case "wins":
      return "Most H2H wins";
    case "losses":
      return "Most H2H losses";
    case "undefeated":
      return "Finished undefeated";
    case "first-loss-week":
      return "Latest first loss";
    case "league-points":
      return "League-points tiebreak";
    case "season-correct-picks":
      return "Season correct-picks tiebreak";
    case "offline-coin-flip":
      return "Offline commissioner coin flip";
    default:
      return "Official season result";
  }
}

function getPrimaryMetric(
  category: SeasonAwardCategory,
  candidate: SeasonAwardCandidate,
): string {
  if (category === "biggest-winner") {
    return `${candidate.wins} win${
      candidate.wins === 1 ? "" : "s"
    }`;
  }

  if (category === "biggest-loser") {
    return `${candidate.losses} loss${
      candidate.losses === 1 ? "" : "es"
    }`;
  }

  if (candidate.undefeated) {
    return "Undefeated";
  }

  return candidate.firstLossWeek === null
    ? "No recorded loss"
    : `First loss: Week ${candidate.firstLossWeek}`;
}

function getCandidateById(
  result: SeasonAwardResult,
  playerId: string,
): SeasonAwardCandidate | null {
  return (
    result.candidates.find(
      (candidate) =>
        candidate.playerId === playerId,
    ) ?? null
  );
}

function AwardCandidate({
  category,
  candidate,
  emphasized = false,
}: {
  category: SeasonAwardCategory;
  candidate: SeasonAwardCandidate;
  emphasized?: boolean;
}) {
  return (
    <div
      className={[
        "season-award-candidate",
        emphasized
          ? "season-award-candidate--emphasized"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <FranchiseLogo
        nflTeam={candidate.nflTeam}
        displayName={candidate.playerName}
        size="sm"
        variant="tile"
      />

      <div className="season-award-candidate-copy">
        <strong>{candidate.playerName}</strong>

        <span>
          {candidate.nflTeam} •{" "}
          {getPrimaryMetric(
            category,
            candidate,
          )}
        </span>
      </div>

      <div className="season-award-candidate-stats">
        <span>
          {candidate.leaguePoints} pts
        </span>

        <small>
          {candidate.seasonCorrectPicks}{" "}
          eligible picks
        </small>
      </div>
    </div>
  );
}

function SeasonAwardCard({
  result,
  showCoinFlipControls,
}: {
  result: SeasonAwardResult;
  showCoinFlipControls: boolean;
}) {
  const {
    recordCoinFlipWinner,
    clearCoinFlipResolution,
    getCoinFlipResolution,
  } = useSeasonAwards();

  const coinFlipResolution =
    getCoinFlipResolution(result.category);

  const coinFlipPlayerIds =
    coinFlipResolution?.eligiblePlayerIds ??
    result.coinFlipPlayerIds;

  const coinFlipCandidates =
    coinFlipPlayerIds
      .map((playerId) =>
        getCandidateById(result, playerId),
      )
      .filter(
        (
          candidate,
        ): candidate is SeasonAwardCandidate =>
          Boolean(candidate),
      );

  const defaultWinnerId =
    coinFlipResolution?.winnerPlayerId ??
    coinFlipCandidates[0]?.playerId ??
    "";

  const [
    selectedWinnerId,
    setSelectedWinnerId,
  ] = useState(defaultWinnerId);

  const [actionError, setActionError] =
    useState<string | null>(null);

  useEffect(() => {
    setSelectedWinnerId(defaultWinnerId);
    setActionError(null);
  }, [
    defaultWinnerId,
    result.id,
    result.status,
  ]);

  const leadingCandidates =
    result.leadingPlayerIds
      .map((playerId) =>
        getCandidateById(result, playerId),
      )
      .filter(
        (
          candidate,
        ): candidate is SeasonAwardCandidate =>
          Boolean(candidate),
      );

  const shouldShowCoinFlipPanel =
    showCoinFlipControls &&
    (result.status ===
      "coin-flip-required" ||
      Boolean(coinFlipResolution));

  const saveCoinFlipWinner = () => {
    setActionError(null);

    try {
      recordCoinFlipWinner(
        result.category,
        selectedWinnerId,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to save the coin-flip winner.",
      );
    }
  };

  const clearCoinFlipWinner = () => {
    clearCoinFlipResolution(
      result.category,
    );
    setSelectedWinnerId(
      coinFlipCandidates[0]?.playerId ??
        "",
    );
    setActionError(null);
  };

  return (
    <article
      className={[
        "season-award-card",
        `season-award-card--${result.status}`,
      ].join(" ")}
    >
      <header className="season-award-card-header">
        <div>
          <span className="season-award-kicker">
            Season Award
          </span>

          <h3>{result.title}</h3>

          <p>
            {
              CATEGORY_DESCRIPTIONS[
                result.category
              ]
            }
          </p>
        </div>

        <div className="season-award-card-meta">
          <span className={getStatusClass(result)}>
            {getStatusLabel(result)}
          </span>

          <strong>
            {formatMoney(
              CATEGORY_PAYOUTS_CENTS[
                result.category
              ],
            )}
          </strong>
        </div>
      </header>

      {result.status === "unavailable" ? (
        <div className="season-award-empty">
          <strong>
            No eligible H2H results yet
          </strong>

          <span>
            At least one completed head-to-head
            matchup is required.
          </span>
        </div>
      ) : null}

      {result.winner ? (
        <div className="season-award-winner">
          <span className="season-award-winner-label">
            {result.isSeasonFinal
              ? "Official Winner"
              : "Current Leader"}
          </span>

          <AwardCandidate
            category={result.category}
            candidate={result.winner}
            emphasized
          />

          <small>
            {getResolutionMethodLabel(
              result.winner.resolutionMethod,
            )}
          </small>
        </div>
      ) : null}

      {!result.winner &&
      leadingCandidates.length > 0 ? (
        <div className="season-award-leaders">
          <span>
            {result.status ===
            "coin-flip-required"
              ? "Tied Finalists"
              : "Current Leaders"}
          </span>

          <div className="season-award-candidate-list">
            {leadingCandidates.map(
              (candidate) => (
                <AwardCandidate
                  key={candidate.playerId}
                  category={result.category}
                  candidate={candidate}
                  emphasized
                />
              ),
            )}
          </div>
        </div>
      ) : null}

      {result.pendingReason ? (
        <p className="season-award-pending">
          {result.pendingReason}
        </p>
      ) : null}

      {shouldShowCoinFlipPanel ? (
        <div className="season-award-coin-flip">
          <div>
            <strong>
              {coinFlipResolution
                ? "Offline coin-flip winner recorded"
                : "Offline coin flip required"}
            </strong>

            <p>
              Conduct the coin flip offline,
              then record the winner here.
            </p>
          </div>

          <label>
            Coin-Flip Winner

            <select
              value={selectedWinnerId}
              onChange={(event) => {
                setSelectedWinnerId(
                  event.target.value,
                );
                setActionError(null);
              }}
            >
              {coinFlipCandidates.map(
                (candidate) => (
                  <option
                    key={candidate.playerId}
                    value={candidate.playerId}
                  >
                    {candidate.playerName} —{" "}
                    {candidate.nflTeam}
                  </option>
                ),
              )}
            </select>
          </label>

          <div className="season-award-actions">
            <button
              type="button"
              className="season-award-button season-award-button--primary"
              onClick={saveCoinFlipWinner}
              disabled={!selectedWinnerId}
            >
              {coinFlipResolution
                ? "Update Winner"
                : "Record Winner"}
            </button>

            {coinFlipResolution ? (
              <button
                type="button"
                className="season-award-button"
                onClick={clearCoinFlipWinner}
              >
                Clear Decision
              </button>
            ) : null}
          </div>

          {actionError ? (
            <p className="season-award-error">
              {actionError}
            </p>
          ) : null}
        </div>
      ) : null}

      <footer className="season-award-card-footer">
        <span>
          Through Week{" "}
          {result.calculatedThroughWeek || "—"}
        </span>

        <span>
          {result.eligiblePlayerCount} eligible
          player
          {result.eligiblePlayerCount === 1
            ? ""
            : "s"}
        </span>

        <span>
          {result.isSeasonFinal
            ? "Season Final"
            : "Week 18 Pending"}
        </span>
      </footer>
    </article>
  );
}

function SeasonAwardsBoard({
  showCoinFlipControls = false,
}: SeasonAwardsBoardProps) {
  const { season, results } =
    useSeasonAwards();

  const resolvedCount =
    SEASON_AWARD_CATEGORIES.filter(
      (category) =>
        results[category].status ===
        "resolved",
    ).length;

  return (
    <section className="season-awards-board">
      <header className="season-awards-board-header">
        <div>
          <span className="season-award-kicker">
            Regular Season Honors
          </span>

          <h2>{season} Season Awards</h2>

          <p>
            Biggest Winner, Biggest Loser, and
            Last to Lose are calculated from
            finalized regular-season H2H
            results.
          </p>
        </div>

        <div className="season-awards-board-summary">
          <strong>
            {resolvedCount}/
            {SEASON_AWARD_CATEGORIES.length}
          </strong>

          <span>
            Awards finalized
          </span>
        </div>
      </header>

      <div className="season-awards-grid">
        {SEASON_AWARD_CATEGORIES.map(
          (category) => (
            <SeasonAwardCard
              key={category}
              result={results[category]}
              showCoinFlipControls={
                showCoinFlipControls
              }
            />
          ),
        )}
      </div>
    </section>
  );
}

export default SeasonAwardsBoard;
