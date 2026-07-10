import { useMemo } from "react";
import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildPayoutLedgerSummary,
  getPayoutLedgerSeasonId,
} from "../../engine";
import type {
  PayoutLedgerCategory,
  PayoutLedgerEntry,
  PayoutLedgerEntryStatus,
} from "../../engine";
import "../../styles/payout-ledger.css";

const CATEGORY_LABELS: Record<
  PayoutLedgerCategory,
  string
> = {
  "player-buy-in": "Player Buy-In",
  "obscure-stat-award": "Obscure-Stat Award",
  "division-group-payout": "Division Group Payout",
  "afc-winner": "AFC Winner",
  "nfc-winner": "NFC Winner",
  "wild-card-loser": "Wild Card Loser",
  "divisional-loser": "Divisional Loser",
  "conference-loser": "Conference Loser",
  "super-bowl-loser": "Super Bowl Loser",
  "super-bowl-winner": "Super Bowl Winner",
  "biggest-winner": "Biggest Winner",
  "biggest-loser": "Biggest Loser",
  "last-to-lose": "Last to Lose",
  adjustment: "Adjustment",
};

const moneyFormatter = new Intl.NumberFormat(
  "en-US",
  {
    style: "currency",
    currency: "USD",
  },
);

function formatMoney(amountCents: number): string {
  return moneyFormatter.format(amountCents / 100);
}

function formatPaidDate(
  paidAt: string | null,
): string {
  if (!paidAt) {
    return "Not paid";
  }

  const paidDate = new Date(paidAt);

  if (Number.isNaN(paidDate.getTime())) {
    return "Paid";
  }

  return `Paid ${paidDate.toLocaleDateString()}`;
}

function sortLedgerEntries(
  first: PayoutLedgerEntry,
  second: PayoutLedgerEntry,
): number {
  const firstPaid =
    first.status === "paid" ? 1 : 0;
  const secondPaid =
    second.status === "paid" ? 1 : 0;

  if (firstPaid !== secondPaid) {
    return firstPaid - secondPaid;
  }

  const playerComparison =
    first.playerName.localeCompare(
      second.playerName,
    );

  if (playerComparison !== 0) {
    return playerComparison;
  }

  return first.sourceLabel.localeCompare(
    second.sourceLabel,
  );
}

type LedgerEntryRowProps = {
  entry: PayoutLedgerEntry;
  customLogo?: string;
  onStatusChange: (
    entryId: string,
    status: PayoutLedgerEntryStatus,
  ) => void;
  onClearReview: (entryId: string) => void;
};

function LedgerEntryRow({
  entry,
  customLogo,
  onStatusChange,
  onClearReview,
}: LedgerEntryRowProps) {
  const nextStatus: PayoutLedgerEntryStatus =
    entry.status === "paid"
      ? "unpaid"
      : "paid";

  return (
    <article
      className={`payout-ledger__entry payout-ledger__entry--${entry.status}`}
    >
      <div className="payout-ledger__identity">
        <FranchiseLogo
          nflTeam={entry.nflTeam}
          customLogo={customLogo}
          displayName={entry.playerName}
          size="sm"
          variant="tile"
        />

        <div>
          <strong>{entry.playerName}</strong>
          <span>
            {entry.nflTeam || "No NFL team"}
          </span>
        </div>
      </div>

      <div className="payout-ledger__source">
        <strong>
          {CATEGORY_LABELS[entry.category]}
        </strong>
        <span>{entry.sourceLabel}</span>
        {entry.note ? (
          <small>{entry.note}</small>
        ) : null}
      </div>

      <div className="payout-ledger__amount">
        <strong>
          {formatMoney(entry.amountCents)}
        </strong>
        <span>
          {entry.direction === "collection"
            ? "Collection"
            : "Payout"}
        </span>
      </div>

      <div className="payout-ledger__status">
        <SteelBadge
          variant={
            entry.status === "paid"
              ? "success"
              : "neutral"
          }
        >
          {entry.status === "paid"
            ? "Paid"
            : "Unpaid"}
        </SteelBadge>

        {entry.needsReview ? (
          <SteelBadge variant="danger">
            Review Required
          </SteelBadge>
        ) : null}

        <small>
          {formatPaidDate(entry.paidAt)}
        </small>
      </div>

      <div className="payout-ledger__actions">
        <SteelButton
          type="button"
          size="sm"
          variant={
            entry.status === "paid"
              ? "ghost"
              : "primary"
          }
          onClick={() =>
            onStatusChange(
              entry.id,
              nextStatus,
            )
          }
        >
          {entry.status === "paid"
            ? "Mark Unpaid"
            : "Mark Paid"}
        </SteelButton>

        {entry.needsReview ? (
          <SteelButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              onClearReview(entry.id)
            }
          >
            Clear Review
          </SteelButton>
        ) : null}
      </div>
    </article>
  );
}

function CommissionerPayoutLedger() {
  const {
    league,
    payoutLedgerHistory,
    initializePayoutLedgerSeason,
    synchronizePayoutLedgerSeason,
    setPayoutLedgerEntryStatus,
    setPayoutLedgerEntryReviewStatus,
  } = useLeague();
  const { season } = useNFL();

  const ledgerId =
    getPayoutLedgerSeasonId(season);
  const ledger =
    payoutLedgerHistory[ledgerId] ?? null;

  const playerLogoById = useMemo(
    () =>
      new Map(
        league.players.map((player) => [
          player.id,
          player.customLogo,
        ]),
      ),
    [league.players],
  );

  const entries = useMemo(
    () =>
      ledger
        ? Object.values(ledger.entries).sort(
            sortLedgerEntries,
          )
        : [],
    [ledger],
  );

  const collectionEntries = entries.filter(
    (entry) =>
      entry.direction === "collection",
  );
  const payoutEntries = entries.filter(
    (entry) => entry.direction === "payout",
  );
  const summary = ledger
    ? buildPayoutLedgerSummary(ledger)
    : null;

  const handleStatusChange = (
    entryId: string,
    status: PayoutLedgerEntryStatus,
  ) => {
    setPayoutLedgerEntryStatus(
      season,
      entryId,
      status,
    );
  };

  const handleClearReview = (
    entryId: string,
  ) => {
    setPayoutLedgerEntryReviewStatus(
      season,
      entryId,
      false,
    );
  };

  return (
    <section className="payout-ledger">
      <SteelSectionHeader
        eyebrow="Milestone 7"
        title="Commissioner Payout Ledger"
        description={`Track ${season} buy-ins, recognized awards, payments, and remaining league cash.`}
        action={
          <SteelButton
            type="button"
            size="sm"
            variant="secondary"
            onClick={() =>
              ledger
                ? synchronizePayoutLedgerSeason(
                    season,
                  )
                : initializePayoutLedgerSeason(
                    season,
                  )
            }
          >
            {ledger
              ? "Sync Players & Buy-Ins"
              : "Initialize Ledger"}
          </SteelButton>
        }
      />

      {!ledger || !summary ? (
        <SteelCard
          className="payout-ledger__empty"
          variant="elevated"
        >
          <h3>No {season} ledger yet</h3>
          <p>
            Initialize the season ledger to create
            one $25 buy-in record for every active
            player.
          </p>
          <SteelButton
            type="button"
            onClick={() =>
              initializePayoutLedgerSeason(
                season,
              )
            }
          >
            Initialize {season} Ledger
          </SteelButton>
        </SteelCard>
      ) : (
        <>
          <div className="payout-ledger__summary-grid">
            <SteelStatCard
              label="Expected Buy-Ins"
              value={formatMoney(
                summary.expectedCollectionsCents,
              )}
              helper={`${collectionEntries.length} collection records`}
            />
            <SteelStatCard
              label="Collected"
              value={formatMoney(
                summary.collectedCents,
              )}
              helper="Cash received"
            />
            <SteelStatCard
              label="Buy-Ins Due"
              value={formatMoney(
                summary.outstandingCollectionsCents,
              )}
              helper="Still unpaid"
            />
            <SteelStatCard
              label="Payouts Owed"
              value={formatMoney(
                summary.recognizedPayoutsCents,
              )}
              helper={`${payoutEntries.length} payout records`}
            />
            <SteelStatCard
              label="Payouts Paid"
              value={formatMoney(
                summary.paidPayoutsCents,
              )}
              helper="Awards distributed"
            />
            <SteelStatCard
              label="Current Cash"
              value={formatMoney(
                summary.currentBalanceCents,
              )}
              helper="Collected minus paid"
              className={
                summary.currentBalanceCents < 0
                  ? "payout-ledger__negative"
                  : ""
              }
            />
            <SteelStatCard
              label="Projected Balance"
              value={formatMoney(
                summary.projectedBalanceCents,
              )}
              helper="Expected collections minus owed payouts"
              className={
                summary.projectedBalanceCents < 0
                  ? "payout-ledger__negative"
                  : ""
              }
            />
          </div>

          {summary.reviewEntryCount > 0 ? (
            <SteelCard
              className="payout-ledger__review-alert"
              variant="danger"
            >
              <strong>
                {summary.reviewEntryCount} ledger
                {summary.reviewEntryCount === 1
                  ? " entry requires"
                  : " entries require"}{" "}
                commissioner review.
              </strong>
              <span>
                A paid automated award changed or
                became unresolved. Review it before
                clearing the warning.
              </span>
            </SteelCard>
          ) : null}

          <SteelCard
            className="payout-ledger__panel"
            variant="elevated"
            as="section"
          >
            <div className="payout-ledger__panel-heading">
              <div>
                <span>Collections</span>
                <h3>Player Buy-Ins</h3>
              </div>
              <SteelBadge variant="gold">
                {formatMoney(
                  summary.collectedCents,
                )}{" "}
                collected
              </SteelBadge>
            </div>

            <div className="payout-ledger__entries">
              {collectionEntries.length > 0 ? (
                collectionEntries.map((entry) => (
                  <LedgerEntryRow
                    key={entry.id}
                    entry={entry}
                    customLogo={
                      playerLogoById.get(
                        entry.playerId,
                      )
                    }
                    onStatusChange={
                      handleStatusChange
                    }
                    onClearReview={
                      handleClearReview
                    }
                  />
                ))
              ) : (
                <p className="payout-ledger__empty-copy">
                  No collection records are available.
                </p>
              )}
            </div>
          </SteelCard>

          <SteelCard
            className="payout-ledger__panel"
            variant="elevated"
            as="section"
          >
            <div className="payout-ledger__panel-heading">
              <div>
                <span>Awards</span>
                <h3>Recognized Payouts</h3>
              </div>
              <SteelBadge variant="info">
                {formatMoney(
                  summary.outstandingPayoutsCents,
                )}{" "}
                unpaid
              </SteelBadge>
            </div>

            <div className="payout-ledger__entries">
              {payoutEntries.length > 0 ? (
                payoutEntries.map((entry) => (
                  <LedgerEntryRow
                    key={entry.id}
                    entry={entry}
                    customLogo={
                      playerLogoById.get(
                        entry.playerId,
                      )
                    }
                    onStatusChange={
                      handleStatusChange
                    }
                    onClearReview={
                      handleClearReview
                    }
                  />
                ))
              ) : (
                <p className="payout-ledger__empty-copy">
                  Resolved obscure-stat awards and
                  future commissioner-entered payouts
                  will appear here.
                </p>
              )}
            </div>
          </SteelCard>
        </>
      )}
    </section>
  );
}

export default CommissionerPayoutLedger;
