import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ChangeEvent,
  FormEvent,
} from "react";

import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useFutureSeasons } from "../../context/FutureSeasonContext";
import { useLeague } from "../../context/LeagueContext";
import {
  getNFLTeamInfo,
  type FutureSeasonPlanStatus,
  type FutureSeasonPlayerPlan,
  type FutureSeasonRosterDecision,
  type FutureSeasonValidationIssue,
} from "../../engine";
import type { PlayerRole } from "../../types/player";

import "../../styles/futureSeasonDraft.css";

type RosterDecisionFilter =
  | "all"
  | FutureSeasonRosterDecision;

type ReplacementDraft = {
  sourcePlayerId: string;
  name: string;
  email: string;
  customLogo: string;
  role: PlayerRole;
};

function parseSeason(
  value: string | number,
): number {
  const parsedSeason = Number.parseInt(
    String(value),
    10,
  );

  return Number.isInteger(parsedSeason)
    ? parsedSeason
    : 0;
}

function getPlanStatusLabel(
  status: FutureSeasonPlanStatus,
): string {
  if (status === "ready") {
    return "Ready";
  }

  if (status === "activated") {
    return "Activated";
  }

  return "Draft";
}

function getPlanStatusVariant(
  status: FutureSeasonPlanStatus,
): "gold" | "success" | "info" {
  if (status === "ready") {
    return "success";
  }

  if (status === "activated") {
    return "info";
  }

  return "gold";
}

function getDecisionLabel(
  decision: FutureSeasonRosterDecision,
): string {
  if (decision === "replacement") {
    return "Replacement";
  }

  if (decision === "inactive") {
    return "Inactive";
  }

  return "Returning";
}

function getDecisionVariant(
  decision: FutureSeasonRosterDecision,
): "success" | "danger" | "info" {
  if (decision === "replacement") {
    return "info";
  }

  if (decision === "inactive") {
    return "danger";
  }

  return "success";
}

function getRoleLabel(role: PlayerRole): string {
  if (role === "commissioner") {
    return "Primary Commissioner";
  }

  if (role === "backup_commissioner") {
    return "Backup Commissioner";
  }

  return "Player";
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function getIssueKey(
  issue: FutureSeasonValidationIssue,
  index: number,
): string {
  return [
    issue.code,
    issue.playerId ?? "league",
    index,
  ].join("-");
}

function getNextTargetSeason(
  sourceSeason: number,
  targetSeasons: number[],
): number {
  const latestSeason = targetSeasons.reduce(
    (latest, season) =>
      Math.max(latest, season),
    sourceSeason,
  );

  return latestSeason + 1;
}

export default function FutureSeasonDraftPanel() {
  const { league } = useLeague();

  const {
    plans,
    activePlanId,
    activePlan,
    activeValidation,
    activeSummary,
    createPlan,
    setActivePlanId,
    updatePlanDetails,
    updatePlayerPlan,
    markPlayerReturning,
    markPlayerInactive,
    replacePlayer,
    markPlanReady,
    reopenPlan,
    deletePlan,
  } = useFutureSeasons();

  const sourceSeason = parseSeason(
    league.settings.season,
  );

  const [leagueNameDraft, setLeagueNameDraft] =
    useState("");

  const [targetSeasonDraft, setTargetSeasonDraft] =
    useState("");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [decisionFilter, setDecisionFilter] =
    useState<RosterDecisionFilter>("all");

  const [
    replacementDraft,
    setReplacementDraft,
  ] = useState<ReplacementDraft | null>(null);

  const [busyAction, setBusyAction] =
    useState<string | null>(null);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  useEffect(() => {
    setLeagueNameDraft(
      activePlan?.leagueName ?? "",
    );

    setTargetSeasonDraft(
      activePlan
        ? String(activePlan.targetSeason)
        : String(
            sourceSeason > 0
              ? sourceSeason + 1
              : new Date().getFullYear() + 1,
          ),
    );

    setReplacementDraft(null);
  }, [
    activePlan?.id,
    activePlan?.leagueName,
    activePlan?.targetSeason,
    sourceSeason,
  ]);

  const filteredPlayers = useMemo(() => {
    if (!activePlan) {
      return [];
    }

    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return [...activePlan.players]
      .filter((player) => {
        if (
          decisionFilter !== "all" &&
          player.rosterDecision !==
            decisionFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const teamInfo = getNFLTeamInfo(
          player.nflTeam,
        );

        const searchableText = [
          player.name,
          player.nflTeam,
          teamInfo?.displayName ?? "",
          teamInfo?.conference ?? "",
          teamInfo?.division ?? "",
          getRoleLabel(player.role),
          player.email ?? "",
          getDecisionLabel(
            player.rosterDecision,
          ),
        ]
          .join(" ")
          .toLowerCase();

        return searchableText.includes(
          normalizedSearch,
        );
      })
      .sort((left, right) => {
        const leftTeam = getNFLTeamInfo(
          left.nflTeam,
        );

        const rightTeam = getNFLTeamInfo(
          right.nflTeam,
        );

        const divisionDifference = (
          leftTeam?.division ?? ""
        ).localeCompare(
          rightTeam?.division ?? "",
        );

        if (divisionDifference !== 0) {
          return divisionDifference;
        }

        return left.nflTeam.localeCompare(
          right.nflTeam,
        );
      });
  }, [
    activePlan,
    decisionFilter,
    searchTerm,
  ]);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const runAction = (
    actionName: string,
    action: () => void,
  ) => {
    clearMessages();
    setBusyAction(actionName);

    try {
      action();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The future-season action could not be completed.",
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleCreatePlan = () => {
    const targetSeason = getNextTargetSeason(
      sourceSeason,
      plans.map((plan) => plan.targetSeason),
    );

    runAction("create", () => {
      const plan = createPlan(targetSeason);

      setSuccessMessage(
        `${plan.targetSeason} planning draft created. The live ${plan.sourceSeason} season was not changed.`,
      );
    });
  };

  const handlePlanSelection = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    const nextPlanId =
      event.target.value || null;

    runAction("select", () => {
      setActivePlanId(nextPlanId);
    });
  };

  const handleSaveDetails = () => {
    if (!activePlan) {
      return;
    }

    const targetSeason =
      Number.parseInt(
        targetSeasonDraft,
        10,
      );

    runAction("details", () => {
      updatePlanDetails(activePlan.id, {
        leagueName: leagueNameDraft,
        targetSeason,
      });

      setSuccessMessage(
        "Future-season draft details saved.",
      );
    });
  };

  const handleMarkReady = () => {
    if (!activePlan) {
      return;
    }

    runAction("ready", () => {
      markPlanReady(activePlan.id);

      setSuccessMessage(
        `${activePlan.targetSeason} is marked ready for a later activation package. Nothing was activated now.`,
      );
    });
  };

  const handleReopen = () => {
    if (!activePlan) {
      return;
    }

    runAction("reopen", () => {
      reopenPlan(activePlan.id);

      setSuccessMessage(
        `${activePlan.targetSeason} was returned to draft status.`,
      );
    });
  };

  const handleDelete = () => {
    if (!activePlan) {
      return;
    }

    const approved = window.confirm(
      `Delete the ${activePlan.targetSeason} planning draft?\n\nThis deletes only the future-season draft. It does not change the live ${activePlan.sourceSeason} league.`,
    );

    if (!approved) {
      return;
    }

    runAction("delete", () => {
      const deletedSeason =
        activePlan.targetSeason;

      deletePlan(activePlan.id);

      setSuccessMessage(
        `${deletedSeason} planning draft deleted. The live league was not changed.`,
      );
    });
  };

  const openReplacementEditor = (
    player: FutureSeasonPlayerPlan,
  ) => {
    clearMessages();

    setReplacementDraft({
      sourcePlayerId: player.sourcePlayerId,
      name:
        player.rosterDecision ===
        "replacement"
          ? player.name
          : "",
      email:
        player.rosterDecision ===
        "replacement"
          ? player.email ?? ""
          : "",
      customLogo:
        player.rosterDecision ===
        "replacement"
          ? player.customLogo ?? ""
          : "",
      role: player.role,
    });
  };

  const closeReplacementEditor = () => {
    setReplacementDraft(null);
  };

  const handleReplacementFieldChange = (
    field: keyof Omit<
      ReplacementDraft,
      "sourcePlayerId"
    >,
    value: string,
  ) => {
    setReplacementDraft((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        [field]: value,
      };
    });
  };

  const handleReplacementSubmit = (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (
      !activePlan ||
      !replacementDraft
    ) {
      return;
    }

    const player = activePlan.players.find(
      (candidate) =>
        candidate.sourcePlayerId ===
        replacementDraft.sourcePlayerId,
    );

    if (!player) {
      setErrorMessage(
        "The selected future-season player could not be found.",
      );

      return;
    }

    const replacementName =
      replacementDraft.name.trim();

    if (!replacementName) {
      setErrorMessage(
        "Enter the replacement player’s name.",
      );

      return;
    }

    runAction(
      `replace-${player.sourcePlayerId}`,
      () => {
        replacePlayer(
          activePlan.id,
          player.sourcePlayerId,
          {
            playerId:
              player.rosterDecision ===
              "replacement"
                ? player.playerId
                : undefined,
            name: replacementName,
            nflTeam: player.nflTeam,
            email:
              replacementDraft.email.trim() ||
              undefined,
            customLogo:
              replacementDraft.customLogo.trim() ||
              undefined,
            role: replacementDraft.role,
            status: "active",
          },
        );

        setReplacementDraft(null);

        setSuccessMessage(
          `${replacementName} is planned as the ${player.nflTeam} replacement. The previous player’s cloud login will not transfer.`,
        );
      },
    );
  };

  const handleMarkPlayerInactive = (
    player: FutureSeasonPlayerPlan,
  ) => {
    if (!activePlan) {
      return;
    }

    const approved = window.confirm(
      `Mark ${player.name} inactive for ${activePlan.targetSeason}?\n\nThe ${player.nflTeam} franchise will need a replacement before the plan can be marked ready.`,
    );

    if (!approved) {
      return;
    }

    runAction(
      `inactive-${player.sourcePlayerId}`,
      () => {
        markPlayerInactive(
          activePlan.id,
          player.sourcePlayerId,
        );

        if (
          replacementDraft?.sourcePlayerId ===
          player.sourcePlayerId
        ) {
          setReplacementDraft(null);
        }

        setSuccessMessage(
          `${player.name} is marked inactive for ${activePlan.targetSeason}. The live ${activePlan.sourceSeason} roster was not changed.`,
        );
      },
    );
  };

  const handleRestoreReturningPlayer = (
    player: FutureSeasonPlayerPlan,
  ) => {
    if (!activePlan) {
      return;
    }

    runAction(
      `returning-${player.sourcePlayerId}`,
      () => {
        if (
          player.rosterDecision ===
          "replacement"
        ) {
          const sourcePlayer =
            league.players.find(
              (candidate) =>
                candidate.id ===
                player.sourcePlayerId,
            );

          if (!sourcePlayer) {
            throw new Error(
              "The original live-season player could not be found.",
            );
          }

          updatePlayerPlan(
            activePlan.id,
            player.sourcePlayerId,
            {
              playerId: sourcePlayer.id,
              name: sourcePlayer.name,
              nflTeam: sourcePlayer.nflTeam,
              email: sourcePlayer.email,
              customLogo:
                sourcePlayer.customLogo,
              role: sourcePlayer.role,
              status: "active",
              rosterDecision: "returning",
              preservesCloudLink: true,
            },
          );
        } else {
          markPlayerReturning(
            activePlan.id,
            player.sourcePlayerId,
          );
        }

        if (
          replacementDraft?.sourcePlayerId ===
          player.sourcePlayerId
        ) {
          setReplacementDraft(null);
        }

        setSuccessMessage(
          `The original ${player.nflTeam} owner is restored as returning for ${activePlan.targetSeason}.`,
        );
      },
    );
  };

  const editingDisabled =
    busyAction !== null ||
    activePlan?.status === "activated";

  return (
    <SteelCard
      as="section"
      className="future-season-draft"
      variant="gold"
    >
      <SteelSectionHeader
        eyebrow="Future Season Planning"
        title="Prepare Next Season"
        description="Build and review a future-season roster without resetting, replacing, or activating the current league."
        action={
          activePlan ? (
            <SteelBadge
              variant={getPlanStatusVariant(
                activePlan.status,
              )}
            >
              {activePlan.targetSeason}{" "}
              {getPlanStatusLabel(
                activePlan.status,
              )}
            </SteelBadge>
          ) : (
            <SteelBadge variant="neutral">
              No Draft
            </SteelBadge>
          )
        }
      />

      <div className="future-season-draft__safety">
        <div>
          <strong>Planning mode only</strong>

          <span>
            The active {sourceSeason || "current"}{" "}
            season, picks, standings, payouts, cloud
            accounts, and player invitations are not
            changed by this screen.
          </span>
        </div>

        <SteelBadge variant="success">
          Live Season Protected
        </SteelBadge>
      </div>

      {errorMessage ? (
        <p
          className="future-season-draft__message future-season-draft__message--error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          aria-live="polite"
          className="future-season-draft__message future-season-draft__message--success"
        >
          {successMessage}
        </p>
      ) : null}

      {plans.length === 0 ? (
        <div className="future-season-draft__empty">
          <span
            aria-hidden="true"
            className="future-season-draft__empty-year"
          >
            {sourceSeason > 0
              ? sourceSeason + 1
              : "NEXT"}
          </span>

          <div>
            <strong>
              No future-season draft exists
            </strong>

            <p>
              Create a protected planning copy of the
              current roster. Returning players retain
              their player IDs so their existing cloud
              account links can be preserved later.
            </p>
          </div>

          <SteelButton
            disabled={busyAction !== null}
            onClick={handleCreatePlan}
            size="lg"
            type="button"
            variant="primary"
          >
            Create{" "}
            {sourceSeason > 0
              ? sourceSeason + 1
              : "Next Season"}{" "}
            Draft
          </SteelButton>
        </div>
      ) : (
        <>
          <div className="future-season-draft__toolbar">
            <label>
              <span>Planning draft</span>

              <select
                disabled={busyAction !== null}
                onChange={handlePlanSelection}
                value={activePlanId ?? ""}
              >
                {plans.map((plan) => (
                  <option
                    key={plan.id}
                    value={plan.id}
                  >
                    {plan.targetSeason} ·{" "}
                    {getPlanStatusLabel(
                      plan.status,
                    )}
                  </option>
                ))}
              </select>
            </label>

            <div className="future-season-draft__toolbar-actions">
              <SteelButton
                disabled={busyAction !== null}
                onClick={handleCreatePlan}
                size="sm"
                type="button"
                variant="secondary"
              >
                Create Another Draft
              </SteelButton>

              <SteelButton
                disabled={
                  busyAction !== null ||
                  !activePlan
                }
                onClick={handleDelete}
                size="sm"
                type="button"
                variant="danger"
              >
                Delete Draft
              </SteelButton>
            </div>
          </div>

          {activePlan && activeSummary ? (
            <>
              <section className="future-season-draft__stats">
                <SteelStatCard
                  label="Target Season"
                  value={activePlan.targetSeason}
                  helper={`From ${activePlan.sourceSeason}`}
                  icon="📅"
                />

                <SteelStatCard
                  label="Active Owners"
                  value={`${activeSummary.activePlayers}/32`}
                  helper="Future roster"
                  icon="👥"
                />

                <SteelStatCard
                  label="Returning"
                  value={
                    activeSummary.returningPlayers
                  }
                  helper={`${activeSummary.replacementPlayers} replacements`}
                  icon="↩"
                />

                <SteelStatCard
                  label="Cloud Links"
                  value={
                    activeSummary.preservedCloudLinks
                  }
                  helper="Planned to preserve"
                  icon="☁"
                />

                <SteelStatCard
                  label="Validation"
                  value={
                    activeSummary.issueCount === 0
                      ? "Ready"
                      : activeSummary.issueCount
                  }
                  helper={
                    activeSummary.issueCount === 0
                      ? "No issues found"
                      : "Issues to resolve"
                  }
                  icon={
                    activeSummary.issueCount === 0
                      ? "✓"
                      : "!"
                  }
                />
              </section>

              <div className="future-season-draft__details">
                <div className="future-season-draft__details-heading">
                  <div>
                    <span>Draft Information</span>

                    <h3>
                      {activePlan.targetSeason} Season
                    </h3>
                  </div>

                  <small>
                    Last updated{" "}
                    {formatDate(
                      activePlan.updatedAt,
                    )}
                  </small>
                </div>

                <div className="future-season-draft__details-fields">
                  <label>
                    <span>League name</span>

                    <input
                      disabled={editingDisabled}
                      onChange={(event) =>
                        setLeagueNameDraft(
                          event.target.value,
                        )
                      }
                      type="text"
                      value={leagueNameDraft}
                    />
                  </label>

                  <label>
                    <span>Target season</span>

                    <input
                      disabled={editingDisabled}
                      min={
                        activePlan.sourceSeason + 1
                      }
                      onChange={(event) =>
                        setTargetSeasonDraft(
                          event.target.value,
                        )
                      }
                      type="number"
                      value={targetSeasonDraft}
                    />
                  </label>

                  <SteelButton
                    disabled={editingDisabled}
                    onClick={handleSaveDetails}
                    size="md"
                    type="button"
                    variant="primary"
                  >
                    Save Draft Details
                  </SteelButton>
                </div>
              </div>

              <div className="future-season-draft__validation">
                <div className="future-season-draft__validation-heading">
                  <div>
                    <span>Safety Review</span>

                    <h3>Draft Validation</h3>
                  </div>

                  <SteelBadge
                    variant={
                      activeValidation?.ready
                        ? "success"
                        : "danger"
                    }
                  >
                    {activeValidation?.ready
                      ? "All Checks Passed"
                      : `${activeValidation?.issues.length ?? 0} Issues`}
                  </SteelBadge>
                </div>

                {activeValidation?.ready ? (
                  <p className="future-season-draft__validation-ready">
                    The future-season draft currently
                    has one active owner for each NFL
                    franchise and valid commissioner
                    assignments.
                  </p>
                ) : (
                  <ul className="future-season-draft__issues">
                    {activeValidation?.issues.map(
                      (issue, index) => (
                        <li
                          key={getIssueKey(
                            issue,
                            index,
                          )}
                        >
                          {issue.message}
                        </li>
                      ),
                    )}
                  </ul>
                )}

                <div className="future-season-draft__validation-actions">
                  {activePlan.status === "ready" ? (
                    <SteelButton
                      disabled={
                        busyAction !== null
                      }
                      onClick={handleReopen}
                      size="md"
                      type="button"
                      variant="secondary"
                    >
                      Reopen Draft
                    </SteelButton>
                  ) : (
                    <SteelButton
                      disabled={
                        busyAction !== null ||
                        !activeValidation?.ready
                      }
                      onClick={handleMarkReady}
                      size="md"
                      type="button"
                      variant="primary"
                    >
                      Mark Plan Ready
                    </SteelButton>
                  )}

                  <span>
                    Marking a plan ready does not
                    activate it.
                  </span>
                </div>
              </div>

              <div className="future-season-draft__roster-heading">
                <div>
                  <span>Future Roster Editor</span>

                  <h3>Franchise Owners</h3>
                </div>

                <SteelBadge variant="neutral">
                  {filteredPlayers.length} shown
                </SteelBadge>
              </div>

              <div className="future-season-draft__roster-toolbar">
                <label>
                  <span>Search roster</span>

                  <input
                    onChange={(event) =>
                      setSearchTerm(
                        event.target.value,
                      )
                    }
                    placeholder="Player, NFL team, division, or email"
                    type="search"
                    value={searchTerm}
                  />
                </label>

                <label>
                  <span>Roster decision</span>

                  <select
                    onChange={(event) =>
                      setDecisionFilter(
                        event.target
                          .value as RosterDecisionFilter,
                      )
                    }
                    value={decisionFilter}
                  >
                    <option value="all">
                      All decisions
                    </option>

                    <option value="returning">
                      Returning
                    </option>

                    <option value="replacement">
                      Replacements
                    </option>

                    <option value="inactive">
                      Inactive
                    </option>
                  </select>
                </label>
              </div>

              <div className="future-season-draft__roster">
                {filteredPlayers.map((player) => {
                  const teamInfo =
                    getNFLTeamInfo(
                      player.nflTeam,
                    );

                  const isEditingReplacement =
                    replacementDraft
                      ?.sourcePlayerId ===
                    player.sourcePlayerId;

                  return (
                    <article
                      className={[
                        "future-season-player",
                        `future-season-player--${player.rosterDecision}`,
                        isEditingReplacement
                          ? "future-season-player--editing"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      key={player.sourcePlayerId}
                    >
                      <div className="future-season-player__heading">
                        <FranchiseLogo
                          customLogo={
                            player.customLogo
                          }
                          displayName={
                            player.name
                          }
                          nflTeam={
                            player.nflTeam
                          }
                          size="md"
                          variant="tile"
                        />

                        <div>
                          <strong>
                            {player.name}
                          </strong>

                          <span>
                            {player.nflTeam} ·{" "}
                            {teamInfo?.displayName ??
                              "NFL Franchise"}
                          </span>
                        </div>

                        <SteelBadge
                          variant={getDecisionVariant(
                            player.rosterDecision,
                          )}
                        >
                          {getDecisionLabel(
                            player.rosterDecision,
                          )}
                        </SteelBadge>
                      </div>

                      <div className="future-season-player__details">
                        <span>
                          {teamInfo?.conference ??
                            "NFL"}
                        </span>

                        <span>
                          {teamInfo?.division ??
                            "Division unavailable"}
                        </span>

                        <span>
                          {getRoleLabel(
                            player.role,
                          )}
                        </span>
                      </div>

                      <div className="future-season-player__link">
                        <span>
                          Cloud account link
                        </span>

                        <strong>
                          {player.preservesCloudLink
                            ? "Preserved"
                            : "Not transferred"}
                        </strong>
                      </div>

                      <div className="future-season-player__actions">
                        {player.rosterDecision !==
                        "returning" ? (
                          <SteelButton
                            disabled={editingDisabled}
                            onClick={() =>
                              handleRestoreReturningPlayer(
                                player,
                              )
                            }
                            size="sm"
                            type="button"
                            variant="secondary"
                          >
                            {player.rosterDecision ===
                            "replacement"
                              ? "Restore Original"
                              : "Restore Returning"}
                          </SteelButton>
                        ) : null}

                        {player.rosterDecision !==
                        "inactive" ? (
                          <SteelButton
                            disabled={editingDisabled}
                            onClick={() =>
                              handleMarkPlayerInactive(
                                player,
                              )
                            }
                            size="sm"
                            type="button"
                            variant="danger"
                          >
                            Mark Inactive
                          </SteelButton>
                        ) : null}

                        <SteelButton
                          disabled={editingDisabled}
                          onClick={() =>
                            openReplacementEditor(
                              player,
                            )
                          }
                          size="sm"
                          type="button"
                          variant={
                            player.rosterDecision ===
                            "replacement"
                              ? "primary"
                              : "secondary"
                          }
                        >
                          {player.rosterDecision ===
                          "replacement"
                            ? "Edit Replacement"
                            : "Replace Player"}
                        </SteelButton>
                      </div>

                      {isEditingReplacement &&
                      replacementDraft ? (
                        <form
                          className="future-season-player__replacement-form"
                          onSubmit={
                            handleReplacementSubmit
                          }
                        >
                          <div className="future-season-player__replacement-heading">
                            <div>
                              <span>
                                Replacement owner
                              </span>

                              <strong>
                                {player.nflTeam} remains
                                assigned
                              </strong>
                            </div>

                            <SteelBadge variant="info">
                              New Account
                            </SteelBadge>
                          </div>

                          <label>
                            <span>Player name</span>

                            <input
                              autoFocus
                              onChange={(event) =>
                                handleReplacementFieldChange(
                                  "name",
                                  event.target.value,
                                )
                              }
                              placeholder="Replacement player name"
                              type="text"
                              value={
                                replacementDraft.name
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Login email — optional
                            </span>

                            <input
                              onChange={(event) =>
                                handleReplacementFieldChange(
                                  "email",
                                  event.target.value,
                                )
                              }
                              placeholder="replacement@example.com"
                              type="email"
                              value={
                                replacementDraft.email
                              }
                            />
                          </label>

                          <label>
                            <span>
                              Custom logo path — optional
                            </span>

                            <input
                              onChange={(event) =>
                                handleReplacementFieldChange(
                                  "customLogo",
                                  event.target.value,
                                )
                              }
                              placeholder="/logos/franchises/example.png"
                              type="text"
                              value={
                                replacementDraft.customLogo
                              }
                            />
                          </label>

                          <label>
                            <span>League role</span>

                            <select
                              onChange={(event) =>
                                handleReplacementFieldChange(
                                  "role",
                                  event.target
                                    .value as PlayerRole,
                                )
                              }
                              value={
                                replacementDraft.role
                              }
                            >
                              <option value="player">
                                Player
                              </option>

                              <option value="commissioner">
                                Primary Commissioner
                              </option>

                              <option value="backup_commissioner">
                                Backup Commissioner
                              </option>
                            </select>
                          </label>

                          <p>
                            The replacement receives a
                            new player ID. The prior
                            player’s cloud login and
                            account link will not
                            transfer.
                          </p>

                          <div className="future-season-player__replacement-actions">
                            <SteelButton
                              disabled={
                                busyAction !== null
                              }
                              size="sm"
                              type="submit"
                              variant="primary"
                            >
                              Save Replacement
                            </SteelButton>

                            <SteelButton
                              disabled={
                                busyAction !== null
                              }
                              onClick={
                                closeReplacementEditor
                              }
                              size="sm"
                              type="button"
                              variant="secondary"
                            >
                              Cancel
                            </SteelButton>
                          </div>
                        </form>
                      ) : null}
                    </article>
                  );
                })}
              </div>

              {filteredPlayers.length === 0 ? (
                <p className="future-season-draft__no-results">
                  No future-season players match the
                  current search and filter.
                </p>
              ) : null}
            </>
          ) : null}
        </>
      )}
    </SteelCard>
  );
}