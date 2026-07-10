import {
  useMemo,
  useState,
} from "react";
import type { FormEvent } from "react";
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
  PAYOUT_LEDGER_AMOUNTS_CENTS,
  buildPayoutLedgerReconciliation,
  buildPayoutLedgerSummary,
  createPayoutLedgerEntry,
  getPayoutLedgerSeasonId,
} from "../../engine";
import type {
  PayoutLedgerCategory,
  PayoutLedgerDirection,
  PayoutLedgerEntry,
  PayoutLedgerEntryStatus,
  PayoutLedgerPlanLine,
} from "../../engine";
import "../../styles/payout-ledger.css";

const CATEGORY_LABELS: Record<
  PayoutLedgerCategory,
  string
> = {
  "player-buy-in": "Player Buy-In",
  "obscure-stat-award": "Obscure-Stat Award",
  "division-group-payout": "Division Group Share",
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

type ValueChangeEvent = {
  target: {
    value: string;
  };
};

type ManualPayoutOption = {
  category: PayoutLedgerCategory;
  label: string;
  amountCents: number | null;
  sourceLabel: string;
};

const MANUAL_PAYOUT_OPTIONS: ManualPayoutOption[] = [
  {
    category: "division-group-payout",
    label: "Division Group Share — $12",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.divisionPlayerShare,
    sourceLabel: "Division group payout share",
  },
  {
    category: "afc-winner",
    label: "AFC Winner — $20",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.afcWinner,
    sourceLabel: "AFC winner payout",
  },
  {
    category: "nfc-winner",
    label: "NFC Winner — $20",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.nfcWinner,
    sourceLabel: "NFC winner payout",
  },
  {
    category: "wild-card-loser",
    label: "Wild Card Loser — $20",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.wildCardLoser,
    sourceLabel: "Wild Card round loser payout",
  },
  {
    category: "divisional-loser",
    label: "Divisional Loser — $40",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.divisionalLoser,
    sourceLabel: "Divisional round loser payout",
  },
  {
    category: "conference-loser",
    label: "Conference Loser — $60",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.conferenceLoser,
    sourceLabel: "Conference round loser payout",
  },
  {
    category: "super-bowl-loser",
    label: "Super Bowl Loser — $80",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlLoser,
    sourceLabel: "Super Bowl runner-up payout",
  },
  {
    category: "super-bowl-winner",
    label: "Super Bowl Winner — $160",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.superBowlWinner,
    sourceLabel: "Super Bowl champion payout",
  },
  {
    category: "biggest-winner",
    label: "Biggest Winner — $15",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.biggestWinner,
    sourceLabel: "Biggest Winner season award",
  },
  {
    category: "biggest-loser",
    label: "Biggest Loser — $1",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.biggestLoser,
    sourceLabel: "Biggest Loser season award",
  },
  {
    category: "last-to-lose",
    label: "Last to Lose — $10",
    amountCents:
      PAYOUT_LEDGER_AMOUNTS_CENTS.lastToLose,
    sourceLabel: "Last to Lose season award",
  },
  {
    category: "adjustment",
    label: "Manual Adjustment",
    amountCents: null,
    sourceLabel: "Commissioner ledger adjustment",
  },
];

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

function getPlanStatusLabel(
  line: PayoutLedgerPlanLine,
): string {
  switch (line.status) {
    case "complete":
      return "Complete";
    case "over":
      return "Over Plan";
    case "mismatch":
      return "Mismatch";
    default:
      return "Missing";
  }
}

function getPlanStatusVariant(
  line: PayoutLedgerPlanLine,
): "success" | "danger" | "neutral" {
  if (line.status === "complete") {
    return "success";
  }

  if (
    line.status === "over" ||
    line.status === "mismatch"
  ) {
    return "danger";
  }

  return "neutral";
}

function PayoutPlanCard({
  line,
}: {
  line: PayoutLedgerPlanLine;
}) {
  return (
    <article
      className={`payout-ledger__plan-card payout-ledger__plan-card--${line.status}`}
    >
      <div className="payout-ledger__plan-heading">
        <strong>{line.label}</strong>
        <SteelBadge
          variant={getPlanStatusVariant(line)}
        >
          {getPlanStatusLabel(line)}
        </SteelBadge>
      </div>

      <div className="payout-ledger__plan-counts">
        <span>
          <strong>{line.actualCount}</strong>
          {" / "}
          {line.expectedCount} entries
        </span>
        <span>
          {formatMoney(line.actualTotalCents)}
          {" / "}
          {formatMoney(line.expectedTotalCents)}
        </span>
      </div>

      <small>
        {line.remainingCount > 0
          ? `${line.remainingCount} remaining`
          : line.status === "complete"
            ? "Official allocation complete"
            : "Review allocation"}
      </small>
    </article>
  );
}

function createManualSourceKey(
  category: PayoutLedgerCategory,
): string {
  const randomPart =
    typeof crypto !== "undefined" &&
    "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random()
          .toString(36)
          .slice(2);

  return `manual-${category}-${Date.now()}-${randomPart}`;
}

type LedgerEntryRowProps = {
  entry: PayoutLedgerEntry;
  customLogo?: string;
  onStatusChange: (
    entryId: string,
    status: PayoutLedgerEntryStatus,
  ) => void;
  onClearReview: (entryId: string) => void;
  onRemove: (entry: PayoutLedgerEntry) => void;
};

function LedgerEntryRow({
  entry,
  customLogo,
  onStatusChange,
  onClearReview,
  onRemove,
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
        {entry.origin === "manual" ? (
          <small>Commissioner entry</small>
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

        {entry.origin === "manual" ? (
          <SteelButton
            type="button"
            size="sm"
            variant="danger"
            onClick={() => onRemove(entry)}
          >
            Remove
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
    upsertPayoutLedgerEntry,
    removePayoutLedgerEntry,
    setPayoutLedgerEntryStatus,
    setPayoutLedgerEntryReviewStatus,
  } = useLeague();
  const { season } = useNFL();

  const ledgerId =
    getPayoutLedgerSeasonId(season);
  const ledger =
    payoutLedgerHistory[ledgerId] ?? null;

  const [selectedPlayerId, setSelectedPlayerId] =
    useState("");
  const [selectedCategory, setSelectedCategory] =
    useState<PayoutLedgerCategory>(
      "division-group-payout",
    );
  const [adjustmentDirection, setAdjustmentDirection] =
    useState<PayoutLedgerDirection>("payout");
  const [adjustmentAmount, setAdjustmentAmount] =
    useState("");
  const [entryStatus, setEntryStatus] =
    useState<PayoutLedgerEntryStatus>("unpaid");
  const [entryNote, setEntryNote] =
    useState("");
  const [formMessage, setFormMessage] =
    useState("");

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

  const manualPlayers = useMemo(
    () =>
      ledger
        ? [...ledger.roster].sort(
            (first, second) =>
              first.playerName.localeCompare(
                second.playerName,
              ),
          )
        : [],
    [ledger],
  );

  const selectedOption =
    MANUAL_PAYOUT_OPTIONS.find(
      (option) =>
        option.category === selectedCategory,
    ) ?? MANUAL_PAYOUT_OPTIONS[0];

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

  const reconciliation = useMemo(
    () =>
      ledger
        ? buildPayoutLedgerReconciliation(
            ledger,
          )
        : null,
    [ledger],
  );

  const planLineByCategory = useMemo(
    () =>
      new Map<
        PayoutLedgerCategory,
        PayoutLedgerPlanLine
      >(
        reconciliation?.lines.map((line) => [
          line.category,
          line,
        ]) ?? [],
      ),
    [reconciliation],
  );

  const selectedPlanLine =
    planLineByCategory.get(
      selectedCategory,
    ) ?? null;

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

  const handleRemoveEntry = (
    entry: PayoutLedgerEntry,
  ) => {
    if (entry.origin !== "manual") {
      return;
    }

    const shouldRemove = window.confirm(
      `Remove the ${CATEGORY_LABELS[entry.category]} entry for ${entry.playerName}?`,
    );

    if (!shouldRemove) {
      return;
    }

    removePayoutLedgerEntry(
      season,
      entry.id,
    );
  };

  const handleManualEntrySubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setFormMessage("");

    if (!ledger) {
      setFormMessage(
        "Initialize the season ledger first.",
      );
      return;
    }

    const player = ledger.roster.find(
      (rosterPlayer) =>
        rosterPlayer.playerId ===
        selectedPlayerId,
    );

    if (!player) {
      setFormMessage(
        "Choose a player for this entry.",
      );
      return;
    }

    const isAdjustment =
      selectedOption.category === "adjustment";

    if (
      !isAdjustment &&
      selectedPlanLine &&
      selectedPlanLine.remainingCount <= 0
    ) {
      setFormMessage(
        `${selectedOption.label} is already fully allocated. Remove an existing entry or use an adjustment.`,
      );
      return;
    }

    const parsedAdjustmentAmount =
      Number.parseFloat(adjustmentAmount);

    const amountCents = isAdjustment
      ? Math.round(
          parsedAdjustmentAmount * 100,
        )
      : selectedOption.amountCents ?? 0;

    if (
      !Number.isInteger(amountCents) ||
      amountCents <= 0
    ) {
      setFormMessage(
        "Enter an adjustment amount greater than $0.",
      );
      return;
    }

    const direction: PayoutLedgerDirection =
      isAdjustment
        ? adjustmentDirection
        : "payout";

    const now = new Date().toISOString();
    const entry = createPayoutLedgerEntry(
      {
        season,
        playerId: player.playerId,
        playerName: player.playerName,
        nflTeam: player.nflTeam,
        direction,
        category: selectedOption.category,
        origin: "manual",
        amountCents,
        status: entryStatus,
        sourceKey: createManualSourceKey(
          selectedOption.category,
        ),
        sourceLabel:
          selectedOption.sourceLabel,
        note: entryNote,
      },
      now,
    );

    upsertPayoutLedgerEntry(
      season,
      entry,
    );

    setEntryNote("");
    setAdjustmentAmount("");
    setEntryStatus("unpaid");
    setFormMessage(
      `${CATEGORY_LABELS[entry.category]} added for ${entry.playerName}.`,
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

      {!ledger || !summary || !reconciliation ? (
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

          <SteelCard
            className="payout-ledger__reconciliation"
            variant="elevated"
            as="section"
          >
            <div className="payout-ledger__panel-heading">
              <div>
                <span>Season Reconciliation</span>
                <h3>Official Prize Schedule</h3>
              </div>
              <SteelBadge
                variant={
                  reconciliation.issueLineCount === 0
                    ? "success"
                    : "neutral"
                }
              >
                {reconciliation.completeLineCount}
                {" / "}
                {reconciliation.lines.length} complete
              </SteelBadge>
            </div>

            <div className="payout-ledger__budget-strip">
              <div>
                <span>32-Player Buy-Ins</span>
                <strong>
                  {formatMoney(
                    reconciliation.fullLeagueBuyInsCents,
                  )}
                </strong>
              </div>
              <div>
                <span>Official Prize Plan</span>
                <strong>
                  {formatMoney(
                    reconciliation.plannedPayoutsCents,
                  )}
                </strong>
              </div>
              <div>
                <span>Planned Reserve</span>
                <strong>
                  {formatMoney(
                    reconciliation.plannedReserveCents,
                  )}
                </strong>
              </div>
              <div>
                <span>Recognized Official</span>
                <strong>
                  {formatMoney(
                    reconciliation.recognizedOfficialPayoutsCents,
                  )}
                </strong>
              </div>
            </div>

            <p className="payout-ledger__reconciliation-copy">
              The official 32-player schedule funds
              $799 in prizes from $800 in buy-ins,
              leaving a $1 season reserve. Manual
              adjustments are tracked separately from
              this prize-plan check.
            </p>

            <div className="payout-ledger__plan-grid">
              {reconciliation.lines.map((line) => (
                <PayoutPlanCard
                  key={line.category}
                  line={line}
                />
              ))}
            </div>

            {reconciliation.adjustmentPayoutsCents > 0 ||
            reconciliation.adjustmentCollectionsCents > 0 ? (
              <div className="payout-ledger__adjustment-summary">
                <span>
                  Adjustment collections:{" "}
                  <strong>
                    {formatMoney(
                      reconciliation.adjustmentCollectionsCents,
                    )}
                  </strong>
                </span>
                <span>
                  Adjustment payouts:{" "}
                  <strong>
                    {formatMoney(
                      reconciliation.adjustmentPayoutsCents,
                    )}
                  </strong>
                </span>
              </div>
            ) : null}
          </SteelCard>

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
            className="payout-ledger__manual-panel"
            variant="elevated"
            as="section"
          >
            <div className="payout-ledger__panel-heading">
              <div>
                <span>Commissioner Entry</span>
                <h3>Add Manual Payout</h3>
              </div>
              <SteelBadge variant="gold">
                Official amounts loaded
              </SteelBadge>
            </div>

            <form
              className="payout-ledger__manual-form"
              onSubmit={handleManualEntrySubmit}
            >
              <label>
                <span>Player</span>
                <select
                  value={selectedPlayerId}
                  onChange={(event: ValueChangeEvent) =>
                    setSelectedPlayerId(
                      event.target.value,
                    )
                  }
                  required
                >
                  <option value="">
                    Select player
                  </option>
                  {manualPlayers.map((player) => (
                    <option
                      key={player.playerId}
                      value={player.playerId}
                    >
                      {player.playerName} — {player.nflTeam}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Payout Type</span>
                <select
                  value={selectedCategory}
                  onChange={(event: ValueChangeEvent) => {
                    setSelectedCategory(
                      event.target
                        .value as PayoutLedgerCategory,
                    );
                    setFormMessage("");
                  }}
                >
                  {MANUAL_PAYOUT_OPTIONS.map(
                    (option) => {
                      const planLine =
                        planLineByCategory.get(
                          option.category,
                        );
                      const isFullyAllocated =
                        option.category !==
                          "adjustment" &&
                        planLine?.remainingCount === 0;

                      return (
                        <option
                          key={option.category}
                          value={option.category}
                          disabled={isFullyAllocated}
                        >
                          {option.label}
                          {isFullyAllocated
                            ? " — Complete"
                            : planLine
                              ? ` — ${planLine.remainingCount} left`
                              : ""}
                        </option>
                      );
                    },
                  )}
                </select>
              </label>

              {selectedCategory === "adjustment" ? (
                <>
                  <label>
                    <span>Direction</span>
                    <select
                      value={adjustmentDirection}
                      onChange={(event: ValueChangeEvent) =>
                        setAdjustmentDirection(
                          event.target
                            .value as PayoutLedgerDirection,
                        )
                      }
                    >
                      <option value="payout">
                        Payout
                      </option>
                      <option value="collection">
                        Collection
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>Amount</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="0.00"
                      value={adjustmentAmount}
                      onChange={(event: ValueChangeEvent) =>
                        setAdjustmentAmount(
                          event.target.value,
                        )
                      }
                      required
                    />
                  </label>
                </>
              ) : (
                <div className="payout-ledger__fixed-amount">
                  <span>Amount</span>
                  <strong>
                    {formatMoney(
                      selectedOption.amountCents ?? 0,
                    )}
                  </strong>
                  {selectedPlanLine ? (
                    <small>
                      {selectedPlanLine.remainingCount}{" "}
                      official slot
                      {selectedPlanLine.remainingCount === 1
                        ? ""
                        : "s"}{" "}
                      remaining
                    </small>
                  ) : null}
                </div>
              )}

              <label>
                <span>Status</span>
                <select
                  value={entryStatus}
                  onChange={(event: ValueChangeEvent) =>
                    setEntryStatus(
                      event.target
                        .value as PayoutLedgerEntryStatus,
                    )
                  }
                >
                  <option value="unpaid">
                    Unpaid
                  </option>
                  <option value="paid">
                    Paid now
                  </option>
                </select>
              </label>

              <label className="payout-ledger__note-field">
                <span>Note</span>
                <input
                  type="text"
                  maxLength={160}
                  placeholder="Optional commissioner note"
                  value={entryNote}
                  onChange={(event: ValueChangeEvent) =>
                    setEntryNote(
                      event.target.value,
                    )
                  }
                />
              </label>

              <div className="payout-ledger__manual-submit">
                <SteelButton type="submit">
                  Add Ledger Entry
                </SteelButton>
                {formMessage ? (
                  <span>{formMessage}</span>
                ) : null}
              </div>
            </form>
          </SteelCard>

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
                    onRemove={
                      handleRemoveEntry
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
                    onRemove={
                      handleRemoveEntry
                    }
                  />
                ))
              ) : (
                <p className="payout-ledger__empty-copy">
                  Resolved obscure-stat awards and
                  commissioner-entered payouts will
                  appear here.
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
