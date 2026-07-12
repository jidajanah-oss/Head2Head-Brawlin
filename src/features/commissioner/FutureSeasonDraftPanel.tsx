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

function isActivePlannedOwner(
  player: FutureSeasonPlayerPlan,
): boolean {
  return (
    player.status === "active" &&
    player.rosterDecision !== "inactive"
  );
}

function getOwnerOptionLabel(
  player: FutureSeasonPlayerPlan,
): string {
  const teamInfo = getNFLTeamInfo(
    player.nflTeam,
  );

  return `${player.name} — ${teamInfo?.displayName ?? player.nflTeam}`;
}

function getTeamDisplayLabel(
  nflTeam: FutureSeasonPlayerPlan["nflTeam"],
): string {
  const teamInfo = getNFLTeamInfo(nflTeam);

  return `${nflTeam} · ${teamInfo?.displayName ?? "NFL Franchise"}`;
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
    setLeadership,
    swapPlayerTeams,
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
  const [
    primaryCommissionerSourcePlayerId,
    setPrimaryCommissionerSourcePlayerId,
  ] = useState("");
  const [
    backupCommissionerSourcePlayerId,
    setBackupCommissionerSourcePlayerId,
  ] = useState("");
  const [
    firstSwapSourcePlayerId,
    setFirstSwapSourcePlayerId,
  ] = useState("");
  const [
    secondSwapSourcePlayerId,
    setSecondSwapSourcePlayerId,
  ] = useState("");
  const [busyAction, setBusyAction] =
    useState<string | null>(null);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);
  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const activePlannedOwners = useMemo(() => {
    if (!activePlan) {
      return [];
    }

    return activePlan.players
      .filter(isActivePlannedOwner)
      .sort((left, right) => {
        const teamDifference =
          left.nflTeam.localeCompare(
            right.nflTeam,
          );

        if (teamDifference !== 0) {
          return teamDifference;
        }

        return left.name.localeCompare(
          right.name,
        );
      });
  }, [activePlan]);

  const leadershipSelectionError = useMemo(() => {
    if (
      !primaryCommissionerSourcePlayerId ||
      !backupCommissionerSourcePlayerId
    ) {
      return "Select both a primary commissioner and a backup commissioner.";
    }

    if (
      primaryCommissionerSourcePlayerId ===
      backupCommissionerSourcePlayerId
    ) {
      return "The same player cannot be both the primary and backup commissioner.";
    }

    const primaryCommissioner =
      activePlannedOwners.find(
        (player) =>
          player.sourcePlayerId ===
          primaryCommissionerSourcePlayerId,
      );
    const backupCommissioner =
      activePlannedOwners.find(
        (player) =>
          player.sourcePlayerId ===
          backupCommissionerSourcePlayerId,
      );

    if (
      !primaryCommissioner ||
      !backupCommissioner
    ) {
      return "Both commissioners must be active owners in the future-season plan.";
    }

    const primaryEmail =
      primaryCommissioner.email
        ?.trim()
        .toLowerCase();
    const backupEmail =
      backupCommissioner.email
        ?.trim()
        .toLowerCase();

    if (
      primaryEmail &&
      backupEmail &&
      primaryEmail === backupEmail
    ) {
      return "The primary and backup commissioners cannot use the same login email.";
    }

    return null;
  }, [
    activePlannedOwners,
    backupCommissionerSourcePlayerId,
    primaryCommissionerSourcePlayerId,
  ]);

  const firstSwapPlayer = useMemo(
    () =>
      activePlannedOwners.find(
        (player) =>
          player.sourcePlayerId ===
          firstSwapSourcePlayerId,
      ) ?? null,
    [
      activePlannedOwners,
      firstSwapSourcePlayerId,
    ],
  );

  const secondSwapPlayer = useMemo(
    () =>
      activePlannedOwners.find(
        (player) =>
          player.sourcePlayerId ===
          secondSwapSourcePlayerId,
      ) ?? null,
    [
      activePlannedOwners,
      secondSwapSourcePlayerId,
    ],
  );


  const reviewSnapshot = useMemo(() => {
    if (!activePlan) {
      return null;
    }

    const sourcePlayersById = new Map(
      league.players.map((player) => [
        player.id,
        player,
      ]),
    );
    const activeOwners = activePlan.players.filter(
      isActivePlannedOwner,
    );
    const returningPlayers = activePlan.players.filter(
      (player) =>
        player.rosterDecision === "returning",
    );
    const replacementPlayers = activePlan.players
      .filter(
        (player) =>
          player.rosterDecision ===
          "replacement",
      )
      .sort((left, right) =>
        left.nflTeam.localeCompare(
          right.nflTeam,
        ),
      );
    const inactivePlayers = activePlan.players
      .filter(
        (player) =>
          player.rosterDecision === "inactive",
      )
      .sort((left, right) =>
        left.nflTeam.localeCompare(
          right.nflTeam,
        ),
      );
    const newAccountPlayers = activeOwners
      .filter(
        (player) =>
          !player.preservesCloudLink,
      )
      .sort((left, right) =>
        left.nflTeam.localeCompare(
          right.nflTeam,
        ),
      );
    const franchiseMoves = activePlan.players.reduce<
      Array<{
        sourcePlayerId: string;
        ownerName: string;
        fromTeam: FutureSeasonPlayerPlan["nflTeam"];
        toTeam: FutureSeasonPlayerPlan["nflTeam"];
      }>
    >((moves, player) => {
      const sourcePlayer = sourcePlayersById.get(
        player.sourcePlayerId,
      );

      if (
        !sourcePlayer ||
        sourcePlayer.nflTeam === player.nflTeam
      ) {
        return moves;
      }

      moves.push({
        sourcePlayerId: player.sourcePlayerId,
        ownerName: player.name,
        fromTeam: sourcePlayer.nflTeam,
        toTeam: player.nflTeam,
      });

      return moves;
    }, []);
    const primaryCommissioner = activeOwners.find(
      (player) =>
        player.role === "commissioner",
    );
    const backupCommissioner = activeOwners.find(
      (player) =>
        player.role === "backup_commissioner",
    );
    const sourcePrimaryCommissioner =
      league.players.find(
        (player) =>
          player.role === "commissioner",
      );
    const sourceBackupCommissioner =
      league.players.find(
        (player) =>
          player.role ===
          "backup_commissioner",
      );
    const leadershipChanged =
      primaryCommissioner?.playerId !==
        sourcePrimaryCommissioner?.id ||
      backupCommissioner?.playerId !==
        sourceBackupCommissioner?.id;

    return {
      activeOwners,
      returningPlayers,
      replacementPlayers,
      inactivePlayers,
      newAccountPlayers,
      franchiseMoves,
      primaryCommissioner,
      backupCommissioner,
      leadershipChanged,
      preservedCloudLinks: activeOwners.filter(
        (player) => player.preservesCloudLink,
      ).length,
    };
  }, [activePlan, league.players]);

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

    const primaryCommissioner =
      activePlan?.players.find(
        (player) =>
          isActivePlannedOwner(player) &&
          player.role === "commissioner",
      );
    const backupCommissioner =
      activePlan?.players.find(
        (player) =>
          isActivePlannedOwner(player) &&
          player.role ===
            "backup_commissioner",
      );

    setPrimaryCommissionerSourcePlayerId(
      primaryCommissioner?.sourcePlayerId ?? "",
    );
    setBackupCommissionerSourcePlayerId(
      backupCommissioner?.sourcePlayerId ?? "",
    );
    setFirstSwapSourcePlayerId("");
    setSecondSwapSourcePlayerId("");
    setReplacementDraft(null);
  }, [activePlan, sourceSeason]);

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

    const targetSeason = Number.parseInt(
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

  const handleSaveLeadership = () => {
    if (!activePlan) {
      return;
    }

    if (leadershipSelectionError) {
      setSuccessMessage(null);
      setErrorMessage(leadershipSelectionError);
      return;
    }

    runAction("leadership", () => {
      setLeadership(activePlan.id, {
        primaryCommissionerSourcePlayerId,
        backupCommissionerSourcePlayerId,
      });
      setSuccessMessage(
        `Leadership assignments saved for the ${activePlan.targetSeason} plan. Live ${activePlan.sourceSeason} permissions and cloud accounts were not changed.`,
      );
    });
  };

  const handleSwapTeams = () => {
    if (!activePlan) {
      return;
    }

    const approved = window.confirm(
      `Swap ${firstSwapPlayer?.name ?? "the first owner"} (${firstSwapPlayer?.nflTeam ?? "unassigned"}) with ${secondSwapPlayer?.name ?? "the second owner"} (${secondSwapPlayer?.nflTeam ?? "unassigned"}) in the ${activePlan.targetSeason} planning draft?\n\nThis changes only the future-season franchise assignments.`,
    );

    if (!approved) {
      return;
    }

    runAction("team-swap", () => {
      const firstName =
        firstSwapPlayer?.name ??
        "The first owner";
      const secondName =
        secondSwapPlayer?.name ??
        "the second owner";

      swapPlayerTeams(activePlan.id, {
        firstSourcePlayerId:
          firstSwapSourcePlayerId,
        secondSourcePlayerId:
          secondSwapSourcePlayerId,
      });
      setFirstSwapSourcePlayerId("");
      setSecondSwapSourcePlayerId("");
      setSuccessMessage(
        `${firstName} and ${secondName} exchanged NFL franchises in the ${activePlan.targetSeason} plan. The live ${activePlan.sourceSeason} league was not changed.`,
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

    if (!activePlan || !replacementDraft) {
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
            status: "active",
          },
        );
        setReplacementDraft(null);
        setSuccessMessage(
          `${replacementName} is planned as the ${player.nflTeam} replacement. The previous player’s cloud login and commissioner authority will not transfer.`,
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
            season, picks, standings, payouts,
            cloud accounts, and player invitations
            are not changed by this screen.
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
              Create a protected planning copy of
              the current roster. Returning players
              retain their player IDs so their
              existing cloud account links can be
              preserved later.
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
                  icon=""
                />
                <SteelStatCard
                  label="Active Owners"
                  value={`${activeSummary.activePlayers}/32`}
                  helper="Future roster"
                  icon=""
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

              <div className="future-season-draft__planning-grid">
                <section className="future-season-draft__planning-card">
                  <div className="future-season-draft__planning-heading">
                    <div>
                      <span>Future Leadership</span>
                      <h3>
                        Commissioner Assignments
                      </h3>
                    </div>
                    <SteelBadge variant="info">
                      Draft Only
                    </SteelBadge>
                  </div>
                  <p className="future-season-draft__planning-copy">
                    Choose exactly one primary and
                    one backup commissioner for the
                    planned season. Saving here does
                    not change current cloud access
                    or live-season permissions.
                  </p>
                  <div className="future-season-draft__planning-fields">
                    <label>
                      <span>
                        Primary commissioner
                      </span>
                      <select
                        disabled={editingDisabled}
                        onChange={(event) =>
                          setPrimaryCommissionerSourcePlayerId(
                            event.target.value,
                          )
                        }
                        value={
                          primaryCommissionerSourcePlayerId
                        }
                      >
                        <option value="">
                          Select primary commissioner
                        </option>
                        {activePlannedOwners.map(
                          (player) => (
                            <option
                              key={
                                player.sourcePlayerId
                              }
                              value={
                                player.sourcePlayerId
                              }
                            >
                              {getOwnerOptionLabel(
                                player,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      <span>
                        Backup commissioner
                      </span>
                      <select
                        disabled={editingDisabled}
                        onChange={(event) =>
                          setBackupCommissionerSourcePlayerId(
                            event.target.value,
                          )
                        }
                        value={
                          backupCommissionerSourcePlayerId
                        }
                      >
                        <option value="">
                          Select backup commissioner
                        </option>
                        {activePlannedOwners.map(
                          (player) => (
                            <option
                              key={
                                player.sourcePlayerId
                              }
                              value={
                                player.sourcePlayerId
                              }
                            >
                              {getOwnerOptionLabel(
                                player,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  {leadershipSelectionError ? (
                    <p
                      className="future-season-draft__message future-season-draft__message--error"
                      role="alert"
                    >
                      {leadershipSelectionError}
                    </p>
                  ) : null}
                  <div className="future-season-draft__planning-actions">
                    <SteelButton
                      disabled={
                        editingDisabled ||
                        Boolean(
                          leadershipSelectionError,
                        )
                      }
                      onClick={
                        handleSaveLeadership
                      }
                      size="md"
                      type="button"
                      variant="primary"
                    >
                      Save Leadership
                    </SteelButton>
                    <span>
                      All other active owners become
                      regular players in the plan.
                    </span>
                  </div>
                </section>

                <section className="future-season-draft__planning-card">
                  <div className="future-season-draft__planning-heading">
                    <div>
                      <span>Team Assignment</span>
                      <h3>Swap NFL Franchises</h3>
                    </div>
                    <SteelBadge variant="gold">
                      Atomic Swap
                    </SteelBadge>
                  </div>
                  <p className="future-season-draft__planning-copy">
                    Exchange the NFL teams assigned
                    to two active planned owners. The
                    swap happens as one draft-only
                    operation, preventing duplicate
                    or unassigned franchises.
                  </p>
                  <div className="future-season-draft__planning-fields">
                    <label>
                      <span>First owner</span>
                      <select
                        disabled={editingDisabled}
                        onChange={(event) =>
                          setFirstSwapSourcePlayerId(
                            event.target.value,
                          )
                        }
                        value={
                          firstSwapSourcePlayerId
                        }
                      >
                        <option value="">
                          Select first owner
                        </option>
                        {activePlannedOwners.map(
                          (player) => (
                            <option
                              key={
                                player.sourcePlayerId
                              }
                              value={
                                player.sourcePlayerId
                              }
                            >
                              {getOwnerOptionLabel(
                                player,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      <span>Second owner</span>
                      <select
                        disabled={editingDisabled}
                        onChange={(event) =>
                          setSecondSwapSourcePlayerId(
                            event.target.value,
                          )
                        }
                        value={
                          secondSwapSourcePlayerId
                        }
                      >
                        <option value="">
                          Select second owner
                        </option>
                        {activePlannedOwners.map(
                          (player) => (
                            <option
                              key={
                                player.sourcePlayerId
                              }
                              value={
                                player.sourcePlayerId
                              }
                            >
                              {getOwnerOptionLabel(
                                player,
                              )}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                  </div>
                  <div className="future-season-draft__swap-preview">
                    <div>
                      <FranchiseLogo
                        customLogo={
                          firstSwapPlayer?.customLogo
                        }
                        displayName={
                          firstSwapPlayer?.name
                        }
                        nflTeam={
                          firstSwapPlayer?.nflTeam
                        }
                        size="sm"
                        variant="tile"
                      />
                      <span>
                        {firstSwapPlayer
                          ? `${firstSwapPlayer.name} · ${firstSwapPlayer.nflTeam}`
                          : "First owner"}
                      </span>
                    </div>
                    <strong aria-hidden="true">
                      ⇄
                    </strong>
                    <div>
                      <FranchiseLogo
                        customLogo={
                          secondSwapPlayer?.customLogo
                        }
                        displayName={
                          secondSwapPlayer?.name
                        }
                        nflTeam={
                          secondSwapPlayer?.nflTeam
                        }
                        size="sm"
                        variant="tile"
                      />
                      <span>
                        {secondSwapPlayer
                          ? `${secondSwapPlayer.name} · ${secondSwapPlayer.nflTeam}`
                          : "Second owner"}
                      </span>
                    </div>
                  </div>
                  <div className="future-season-draft__planning-actions">
                    <SteelButton
                      disabled={
                        editingDisabled ||
                        !firstSwapSourcePlayerId ||
                        !secondSwapSourcePlayerId
                      }
                      onClick={handleSwapTeams}
                      size="md"
                      type="button"
                      variant="secondary"
                    >
                      Swap Franchises
                    </SteelButton>
                    <span>
                      Player IDs, cloud-link plans,
                      logos, and roster decisions stay
                      with each owner.
                    </span>
                  </div>
                </section>
              </div>

              {reviewSnapshot ? (
                <section className="future-season-draft__review">
                  <div className="future-season-draft__review-heading">
                    <div>
                      <span>Commissioner Review</span>
                      <h3>
                        Draft Review &amp; Readiness
                      </h3>
                    </div>
                    <SteelBadge
                      variant={
                        activeValidation?.ready
                          ? "success"
                          : "danger"
                      }
                    >
                      {activeValidation?.ready
                        ? "Review Ready"
                        : "Needs Attention"}
                    </SteelBadge>
                  </div>

                  <p className="future-season-draft__review-copy">
                    Review the planned leadership,
                    roster decisions, cloud-account
                    transitions, and franchise moves
                    before marking this draft ready.
                    This is a read-only summary and
                    cannot activate the season.
                  </p>

                  <div className="future-season-draft__review-summary">
                    <article>
                      <span>Leadership</span>
                      <strong>
                        {reviewSnapshot.primaryCommissioner
                          ?.name ?? "Missing primary"}
                      </strong>
                      <small>
                        Primary ·{" "}
                        {reviewSnapshot.primaryCommissioner
                          ? getTeamDisplayLabel(
                              reviewSnapshot
                                .primaryCommissioner
                                .nflTeam,
                            )
                          : "Unassigned"}
                      </small>
                      <strong>
                        {reviewSnapshot.backupCommissioner
                          ?.name ?? "Missing backup"}
                      </strong>
                      <small>
                        Backup ·{" "}
                        {reviewSnapshot.backupCommissioner
                          ? getTeamDisplayLabel(
                              reviewSnapshot
                                .backupCommissioner
                                .nflTeam,
                            )
                          : "Unassigned"}
                      </small>
                      <em>
                        {reviewSnapshot.leadershipChanged
                          ? "Changed from the live source season"
                          : "Matches the live source season"}
                      </em>
                    </article>

                    <article>
                      <span>Roster Decisions</span>
                      <strong>
                        {
                          reviewSnapshot
                            .returningPlayers.length
                        }{" "}
                        returning
                      </strong>
                      <small>
                        {
                          reviewSnapshot
                            .replacementPlayers.length
                        }{" "}
                        replacements
                      </small>
                      <small>
                        {
                          reviewSnapshot
                            .inactivePlayers.length
                        }{" "}
                        inactive
                      </small>
                      <em>
                        {
                          reviewSnapshot
                            .activeOwners.length
                        }
                        /32 active owners planned
                      </em>
                    </article>

                    <article>
                      <span>Cloud Account Plan</span>
                      <strong>
                        {
                          reviewSnapshot
                            .preservedCloudLinks
                        }{" "}
                        preserved
                      </strong>
                      <small>
                        {
                          reviewSnapshot
                            .newAccountPlayers.length
                        }{" "}
                        new account links required
                      </small>
                      <small>
                        No invitations are sent from
                        this screen.
                      </small>
                      <em>
                        Existing logins never transfer
                        to replacements
                      </em>
                    </article>

                    <article>
                      <span>Franchise Assignment</span>
                      <strong>
                        {
                          reviewSnapshot
                            .franchiseMoves.length
                        }{" "}
                        planned moves
                      </strong>
                      <small>
                        {
                          reviewSnapshot.activeOwners
                            .length
                        }{" "}
                        active franchise slots
                      </small>
                      <small>
                        Team logos can be updated for
                        the new season later.
                      </small>
                      <em>
                        Assignments remain draft-only
                      </em>
                    </article>
                  </div>

                  <div className="future-season-draft__review-changes">
                    <article>
                      <div className="future-season-draft__review-change-heading">
                        <div>
                          <span>Roster Changes</span>
                          <h4>
                            Replacements &amp; Inactive
                          </h4>
                        </div>
                        <SteelBadge
                          variant={
                            reviewSnapshot
                              .inactivePlayers.length > 0
                              ? "danger"
                              : reviewSnapshot
                                    .replacementPlayers
                                    .length > 0
                                ? "info"
                                : "success"
                          }
                        >
                          {
                            reviewSnapshot
                              .replacementPlayers.length +
                            reviewSnapshot
                              .inactivePlayers.length
                          }{" "}
                          Changes
                        </SteelBadge>
                      </div>

                      {reviewSnapshot
                        .replacementPlayers.length === 0 &&
                      reviewSnapshot.inactivePlayers
                        .length === 0 ? (
                        <p className="future-season-draft__review-empty-state">
                          All 32 source-season owners are
                          currently planned to return.
                        </p>
                      ) : (
                        <ul className="future-season-draft__review-list">
                          {reviewSnapshot.replacementPlayers.map(
                            (player) => {
                              const sourcePlayer =
                                league.players.find(
                                  (candidate) =>
                                    candidate.id ===
                                    player.sourcePlayerId,
                                );

                              return (
                                <li
                                  key={`replacement-${player.sourcePlayerId}`}
                                >
                                  <div>
                                    <strong>
                                      {sourcePlayer?.name ??
                                        "Original owner"}{" "}
                                      → {player.name}
                                    </strong>
                                    <span>
                                      {getTeamDisplayLabel(
                                        player.nflTeam,
                                      )}
                                    </span>
                                  </div>
                                  <SteelBadge variant="info">
                                    New Account
                                  </SteelBadge>
                                </li>
                              );
                            },
                          )}
                          {reviewSnapshot.inactivePlayers.map(
                            (player) => (
                              <li
                                key={`inactive-${player.sourcePlayerId}`}
                              >
                                <div>
                                  <strong>
                                    {player.name}
                                  </strong>
                                  <span>
                                    {getTeamDisplayLabel(
                                      player.nflTeam,
                                    )}
                                  </span>
                                </div>
                                <SteelBadge variant="danger">
                                  Needs Replacement
                                </SteelBadge>
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </article>

                    <article>
                      <div className="future-season-draft__review-change-heading">
                        <div>
                          <span>Team Assignment Changes</span>
                          <h4>Franchise Moves</h4>
                        </div>
                        <SteelBadge
                          variant={
                            reviewSnapshot
                              .franchiseMoves.length > 0
                              ? "gold"
                              : "success"
                          }
                        >
                          {
                            reviewSnapshot
                              .franchiseMoves.length
                          }{" "}
                          Moves
                        </SteelBadge>
                      </div>

                      {reviewSnapshot.franchiseMoves
                        .length === 0 ? (
                        <p className="future-season-draft__review-empty-state">
                          Every owner currently keeps the
                          same NFL franchise as the live
                          source season.
                        </p>
                      ) : (
                        <ul className="future-season-draft__review-list">
                          {reviewSnapshot.franchiseMoves.map(
                            (move) => (
                              <li
                                key={`move-${move.sourcePlayerId}`}
                              >
                                <div>
                                  <strong>
                                    {move.ownerName}
                                  </strong>
                                  <span>
                                    {getTeamDisplayLabel(
                                      move.fromTeam,
                                    )}{" "}
                                    →{" "}
                                    {getTeamDisplayLabel(
                                      move.toTeam,
                                    )}
                                  </span>
                                </div>
                                <SteelBadge variant="gold">
                                  Draft Only
                                </SteelBadge>
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </article>
                  </div>

                  <div className="future-season-draft__review-safety">
                    <strong>
                      Review only — no activation
                    </strong>
                    <span>
                      Marking this plan ready records
                      planning status only. The live{" "}
                      {activePlan.sourceSeason} league,
                      Supabase accounts, invitations,
                      picks, standings, and payouts stay
                      unchanged.
                    </span>
                  </div>
                </section>
              ) : null}

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

              <section className="future-season-draft__roster">
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

                <div className="future-season-draft__roster-grid">
                  {filteredPlayers.map((player) => {
                    const teamInfo =
                      getNFLTeamInfo(
                        player.nflTeam,
                      );
                    const isEditingReplacement =
                      replacementDraft?.sourcePlayerId ===
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
                            displayName={player.name}
                            nflTeam={player.nflTeam}
                            size="sm"
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
                            {getRoleLabel(player.role)}
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

                            <div className="future-season-player__replacement-fields">
                              <label>
                                <span>
                                  Player name
                                </span>
                                <input
                                  disabled={
                                    editingDisabled
                                  }
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
                                  disabled={
                                    editingDisabled
                                  }
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
                                  Custom logo path —
                                  optional
                                </span>
                                <input
                                  disabled={
                                    editingDisabled
                                  }
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
                            </div>

                            <p className="future-season-player__replacement-note">
                              The replacement receives a
                              new player ID and begins as
                              a regular player. The prior
                              player’s cloud login,
                              account link, and leadership
                              authority will not transfer.
                            </p>

                            <div className="future-season-player__replacement-actions">
                              <SteelButton
                                disabled={editingDisabled}
                                size="sm"
                                type="submit"
                                variant="primary"
                              >
                                Save Replacement
                              </SteelButton>
                              <SteelButton
                                disabled={editingDisabled}
                                onClick={
                                  closeReplacementEditor
                                }
                                size="sm"
                                type="button"
                                variant="ghost"
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
                  <p className="future-season-draft__roster-empty">
                    No future-season players match the
                    current search and filter.
                  </p>
                ) : null}
              </section>
            </>
          ) : null}
        </>
      )}
    </SteelCard>
  );
}