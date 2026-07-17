import {
  useMemo,
  useState,
} from "react";

import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import { useSeasonAwards } from "../../context/SeasonAwardContext";
import { useSeasonCloseout } from "../../context/SeasonCloseoutContext";
import {
  buildSeasonCloseoutEvaluation,
  createSeasonCloseoutArchive,
  getPayoutLedgerSeasonId,
  getPlayoffSeasonId,
  type SeasonCloseoutArchive,
  type SeasonCloseoutMode,
} from "../../engine";

import "../../styles/season-closeout.css";

const moneyFormatter = new Intl.NumberFormat(
  "en-US",
  {
    style: "currency",
    currency: "USD",
  },
);

function formatMoney(
  amountCents: number,
): string {
  return moneyFormatter.format(
    amountCents / 100,
  );
}

function formatDate(
  timestamp: string,
): string {
  const parsedDate = new Date(timestamp);

  return Number.isNaN(parsedDate.getTime())
    ? timestamp
    : parsedDate.toLocaleString();
}

function getArchiveStatusLabel(
  archive: SeasonCloseoutArchive,
): string {
  return archive.status ===
    "closed-with-override"
    ? "Closed with Override"
    : "Closed";
}

function getChampionName(
  archive: SeasonCloseoutArchive,
): string {
  const playoffSeason =
    archive.snapshot.playoffSeason;

  if (!playoffSeason?.championId) {
    return "No champion recorded";
  }

  const champion = [
    ...playoffSeason.seeds.AFC,
    ...playoffSeason.seeds.NFC,
  ].find(
    (participant) =>
      participant.playerId ===
      playoffSeason.championId,
  );

  return champion
    ? `${champion.playerName} (${champion.nflTeam})`
    : "Champion record unavailable";
}

function getAwardWinnerNames(
  archive: SeasonCloseoutArchive,
): string[] {
  return Object.values(
    archive.snapshot.seasonAwards,
  ).map((result) =>
    result.winner
      ? `${result.title}: ${result.winner.playerName}`
      : `${result.title}: unresolved`,
  );
}

function ArchiveSummary({
  archive,
}: {
  archive: SeasonCloseoutArchive;
}) {
  const scoringRecordCount =
    Object.values(
      archive.snapshot.scoringHistory,
    ).filter(
      (record) =>
        record.season === archive.season,
    ).length;

  const payoutEntryCount =
    Object.keys(
      archive.snapshot.payoutLedger.entries,
    ).length;

  const awardWinnerNames =
    getAwardWinnerNames(archive);

  return (
    <article className="season-closeout-archive-card">
      <header>
        <div>
          <span className="season-closeout-kicker">
            Permanent Season Archive
          </span>

          <h3>
            {archive.season} Season
          </h3>

          <p>
            Closed {formatDate(archive.closedAt)}
          </p>
        </div>

        <span
          className={[
            "season-closeout-status",
            archive.status ===
            "closed-with-override"
              ? "season-closeout-status--warning"
              : "season-closeout-status--complete",
          ].join(" ")}
        >
          {getArchiveStatusLabel(archive)}
        </span>
      </header>

      <div className="season-closeout-archive-grid">
        <div>
          <span>League</span>
          <strong>
            {archive.snapshot.league.settings
              .leagueName || "Head2Head Brawlin'"}
          </strong>
          <small>
            {archive.snapshot.league.players.length}{" "}
            players archived
          </small>
        </div>

        <div>
          <span>League Champion</span>
          <strong>
            {getChampionName(archive)}
          </strong>
          <small>
            Official playoff result
          </small>
        </div>

        <div>
          <span>Finalized Weeks</span>
          <strong>{scoringRecordCount}</strong>
          <small>
            Weekly scoring records
          </small>
        </div>

        <div>
          <span>Ledger Entries</span>
          <strong>{payoutEntryCount}</strong>
          <small>
            Collections and payouts
          </small>
        </div>
      </div>

      <div className="season-closeout-award-summary">
        {awardWinnerNames.map((winnerName) => (
          <span key={winnerName}>
            {winnerName}
          </span>
        ))}
      </div>

      <div className="season-closeout-financial-grid">
        <div>
          <span>Collected</span>
          <strong>
            {formatMoney(
              archive.financials.collectedCents,
            )}
          </strong>
        </div>

        <div>
          <span>Paid Out</span>
          <strong>
            {formatMoney(
              archive.financials.paidPayoutsCents,
            )}
          </strong>
        </div>

        <div>
          <span>Final Balance</span>
          <strong>
            {formatMoney(
              archive.financials.currentBalanceCents,
            )}
          </strong>
        </div>

        <div>
          <span>Expected Reserve</span>
          <strong>
            {formatMoney(
              archive.financials
                .expectedFinalBalanceCents,
            )}
          </strong>
        </div>
      </div>

      {archive.overrideReason ? (
        <div className="season-closeout-override-record">
          <strong>
            Commissioner override reason
          </strong>
          <p>{archive.overrideReason}</p>
        </div>
      ) : null}

      {archive.unresolvedChecks.length > 0 ? (
        <div className="season-closeout-warning-list">
          <strong>
            Warnings captured at closeout
          </strong>

          {archive.unresolvedChecks.map(
            (check) => (
              <div key={check.code}>
                <span>{check.label}</span>
                <small>{check.detail}</small>
              </div>
            ),
          )}
        </div>
      ) : null}

      <footer>
        <span>
          Locked: {archive.lockScope.join(", ")}
        </span>

        <span>
          Confirmation: {archive.confirmationPhrase}
        </span>
      </footer>
    </article>
  );
}

function CommissionerSeasonCloseout() {
  const {
    league,
    picks,
    activePlayerId,
    gameResults,
    scoringHistory,
    pickerClickerHistory,
    obscureStatCoinFlipHistory,
    payoutLedgerHistory,
    playoffResultsHistory,
  } = useLeague();

  const { season } = useNFL();

  const {
    results: seasonAwards,
    coinFlipHistory:
      seasonAwardCoinFlipHistory,
  } = useSeasonAwards();

  const {
    archiveHistory,
    archiveCount,
    storeArchive,
    getArchive,
  } = useSeasonCloseout();

  const [confirmationText, setConfirmationText] =
    useState("");

  const [overrideReason, setOverrideReason] =
    useState("");

  const [actionError, setActionError] =
    useState<string | null>(null);

  const currentArchive = getArchive(season);

  const payoutLedger =
    payoutLedgerHistory[
      getPayoutLedgerSeasonId(season)
    ] ?? null;

  const playoffSeason =
    playoffResultsHistory[
      getPlayoffSeasonId(season)
    ] ?? null;

  const evaluation = useMemo(() => {
    if (!payoutLedger || currentArchive) {
      return null;
    }

    return buildSeasonCloseoutEvaluation({
      season,
      scoringHistory,
      seasonAwards,
      playoffSeason,
      payoutLedger,
    });
  }, [
    season,
    scoringHistory,
    seasonAwards,
    playoffSeason,
    payoutLedger,
    currentArchive,
  ]);

  const archivedSeasons = useMemo(
    () =>
      Object.values(archiveHistory).sort(
        (archiveA, archiveB) =>
          archiveB.season - archiveA.season,
      ),
    [archiveHistory],
  );

  const closeSeason = (
    mode: SeasonCloseoutMode,
  ) => {
    if (
      !evaluation ||
      !payoutLedger ||
      currentArchive
    ) {
      return;
    }

    setActionError(null);

    const closeoutLabel =
      mode === "override"
        ? "close this season with an override"
        : "permanently close this season";

    const approved = window.confirm(
      `Are you sure you want to ${closeoutLabel}? This locks scoring, playoffs, season awards, and the payout ledger.`,
    );

    if (!approved) {
      return;
    }

    try {
      const archive =
        createSeasonCloseoutArchive({
          season,
          mode,
          confirmationText,
          overrideReason,
          scoringHistory,
          seasonAwards,
          playoffSeason,
          payoutLedger,
          snapshot: {
            league: {
              settings: {
                ...league.settings,
              },
              players: league.players,
              currentWeek:
                league.currentWeek,
              games: league.games,
              seasonStatus:
                league.seasonStatus,
              pickStatus:
                league.pickStatus,
            },
            picks,
            activePlayerId,
            gameResults,
            scoringHistory,
            pickerClickerHistory,
            obscureStatCoinFlipHistory,
            playoffSeason,
            seasonAwards,
            seasonAwardCoinFlipHistory,
            payoutLedger,
          },
        });

      storeArchive(archive);
      setConfirmationText("");
      setOverrideReason("");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to close and archive the season.",
      );
    }
  };

  if (currentArchive) {
    return (
      <section className="season-closeout-panel">
        <header className="season-closeout-panel-header">
          <div>
            <span className="season-closeout-kicker">
              Season Closeout
            </span>

            <h2>
              Season {season} Is Locked
            </h2>

            <p>
              The permanent archive is saved and
              protected from normal league resets.
            </p>
          </div>

          <div className="season-closeout-archive-count">
            <strong>{archiveCount}</strong>
            <span>
              Archived season
              {archiveCount === 1 ? "" : "s"}
            </span>
          </div>
        </header>

        <ArchiveSummary archive={currentArchive} />

        {archivedSeasons.length > 1 ? (
          <div className="season-closeout-history">
            <h3>Archive History</h3>

            <div>
              {archivedSeasons.map(
                (archive) => (
                  <article key={archive.id}>
                    <strong>
                      {archive.season}
                    </strong>
                    <span>
                      {getArchiveStatusLabel(
                        archive,
                      )}
                    </span>
                    <small>
                      {formatDate(
                        archive.closedAt,
                      )}
                    </small>
                  </article>
                ),
              )}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="season-closeout-panel">
      
<details className="app-collapsible-panel" data-collapsible-panel>
  <summary className="app-collapsible__summary">
    <span className="app-collapsible__title">Close and Archive Season</span>
    <span className="app-collapsible__state">
      <span className="app-collapsible__open">Open</span>
      <span className="app-collapsible__close">Close</span>
    </span>
  </summary>
  <div className="app-collapsible__content">
<header className="season-closeout-panel-header">
        <div>
          <span className="season-closeout-kicker">
            Season Closeout
          </span>

          <h2>
            Close and Archive Season {season}
          </h2>

          <p>
            Review every final requirement before
            permanently locking the completed season.
          </p>
        </div>

        <div className="season-closeout-archive-count">
          <strong>{archiveCount}</strong>
          <span>
            Archived season
            {archiveCount === 1 ? "" : "s"}
          </span>
        </div>
      </header>
  </div>
</details>

      {!payoutLedger || !evaluation ? (
        <div className="season-closeout-unavailable">
          <strong>
            Payout ledger not initialized
          </strong>
          <p>
            Initialize the current season payout ledger
            before evaluating season closeout.
          </p>
        </div>
      ) : (
        <>
          <div className="season-closeout-progress">
            <div>
              <strong>
                {
                  evaluation.checks.filter(
                    (check) => check.passed,
                  ).length
                }
                /{evaluation.checks.length}
              </strong>
              <span>Checks Passed</span>
            </div>

            <div>
              <strong>
                {evaluation.canCloseNormally
                  ? "Ready"
                  : "Blocked"}
              </strong>
              <span>Normal Closeout</span>
            </div>

            <div>
              <strong>
                {evaluation.unresolvedChecks.length}
              </strong>
              <span>Open Warnings</span>
            </div>
          </div>

          <div className="season-closeout-check-grid">
            {evaluation.checks.map((check) => (
              <article
                className={[
                  "season-closeout-check",
                  check.passed
                    ? "season-closeout-check--passed"
                    : "season-closeout-check--failed",
                ].join(" ")}
                key={check.code}
              >
                <span>
                  {check.passed ? "✓" : "!"}
                </span>

                <div>
                  <strong>{check.label}</strong>
                  <p>{check.detail}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="season-closeout-financial-grid season-closeout-financial-grid--current">
            <div>
              <span>Planned Payouts</span>
              <strong>
                {formatMoney(
                  evaluation.financials
                    .plannedPayoutsCents,
                )}
              </strong>
            </div>

            <div>
              <span>Collected</span>
              <strong>
                {formatMoney(
                  evaluation.financials
                    .collectedCents,
                )}
              </strong>
            </div>

            <div>
              <span>Paid Out</span>
              <strong>
                {formatMoney(
                  evaluation.financials
                    .paidPayoutsCents,
                )}
              </strong>
            </div>

            <div>
              <span>Current Balance</span>
              <strong>
                {formatMoney(
                  evaluation.financials
                    .currentBalanceCents,
                )}
              </strong>
            </div>

            <div>
              <span>Expected Reserve</span>
              <strong>
                {formatMoney(
                  evaluation.financials
                    .expectedFinalBalanceCents,
                )}
              </strong>
            </div>
          </div>

          <div className="season-closeout-confirmation">
            <div>
              <strong>
                Permanent closeout confirmation
              </strong>
              <p>
                Type <code>
                  {evaluation.confirmationPhrase}
                </code>{" "}
                exactly. Closing creates an immutable
                archive and locks all final season
                records.
              </p>
            </div>

            <label>
              Confirmation Text
              <input
                value={confirmationText}
                onChange={(event: { target: { value: string } }) => {
                  setConfirmationText(
                    event.target.value,
                  );
                  setActionError(null);
                }}
                placeholder={
                  evaluation.confirmationPhrase
                }
              />
            </label>

            <button
              type="button"
              className="season-closeout-button season-closeout-button--primary"
              disabled={
                !evaluation.canCloseNormally ||
                confirmationText.trim() !==
                  evaluation.confirmationPhrase
              }
              onClick={() =>
                closeSeason("normal")
              }
            >
              Close Season Normally
            </button>
          </div>

          {!evaluation.canCloseNormally ? (
            <div className="season-closeout-override">
              <div>
                <span className="season-closeout-kicker">
                  Emergency Override
                </span>
                <h3>Close With Unresolved Warnings</h3>
                <p>
                  This permanently records every open
                  warning and labels the archive
                  Closed with Override.
                </p>
              </div>

              <label>
                Required Written Reason
                <textarea
                  value={overrideReason}
                  onChange={(event: { target: { value: string } }) => {
                    setOverrideReason(
                      event.target.value,
                    );
                    setActionError(null);
                  }}
                  placeholder="Explain why the season must be closed before every normal requirement is complete."
                  rows={4}
                />
              </label>

              <button
                type="button"
                className="season-closeout-button season-closeout-button--danger"
                disabled={
                  confirmationText.trim() !==
                    evaluation.confirmationPhrase ||
                  !overrideReason.trim()
                }
                onClick={() =>
                  closeSeason("override")
                }
              >
                Close With Override
              </button>
            </div>
          ) : null}

          {actionError ? (
            <p className="season-closeout-error">
              {actionError}
            </p>
          ) : null}
        </>
      )}

      {archivedSeasons.length > 0 ? (
        <div className="season-closeout-history">
          <h3>Archive History</h3>

          <div>
            {archivedSeasons.map((archive) => (
              <article key={archive.id}>
                <strong>{archive.season}</strong>
                <span>
                  {getArchiveStatusLabel(archive)}
                </span>
                <small>
                  {formatDate(archive.closedAt)}
                </small>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default CommissionerSeasonCloseout;
