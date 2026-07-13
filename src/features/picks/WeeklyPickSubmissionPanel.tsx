import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  getPickerClickerWeekId,
  isPlayerPickerClickerSelected,
  PickLockEngine,
} from "../../engine";
import {
  loadCloudWeeklyPickSubmission,
  reopenCloudWeeklyPickSubmission,
  submitCloudWeeklyPicks,
  type CloudWeeklyPickSubmission,
} from "../../services/cloudWeeklyPickSubmissionService";
import { supabaseClient } from "../../services/supabaseClient";

const STATUS_REFRESH_INTERVAL_MS = 15_000;

function formatSubmissionTime(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to update the weekly submission.";
}

export default function WeeklyPickSubmissionPanel() {
  const { status, accountLink } = useAuth();
  const {
    league,
    picks,
    activePlayerId,
    pickerClickerHistory,
  } = useLeague();
  const { season, week, snapshot } = useNFL();
  const [submission, setSubmission] =
    useState<CloudWeeklyPickSubmission | null>(null);
  const [loading, setLoading] = useState(false);
  const [workingAction, setWorkingAction] = useState<
    "submit" | "reopen" | null
  >(null);
  const [message, setMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const selectedPlayerId = activePlayerId || accountLink?.playerId || "";
  const selectedPlayer = league.players.find(
    (player) => player.id === selectedPlayerId,
  );
  const isLinked = status === "signed-in-linked" && Boolean(accountLink);
  const isViewingOwnPlayer = Boolean(
    accountLink && selectedPlayerId === accountLink.playerId,
  );
  const isCommissioner = Boolean(
    accountLink &&
      (accountLink.role === "commissioner" ||
        accountLink.role === "backup_commissioner"),
  );
  const canReadSelectedSubmission = Boolean(
    isLinked && selectedPlayerId && (isViewingOwnPlayer || isCommissioner),
  );
  const currentWeek = league.currentWeek;
  const gamesAreReady = Boolean(
    snapshot &&
      snapshot.season === season &&
      snapshot.week === currentWeek &&
      week === currentWeek &&
      snapshot.weekGames.length > 0,
  );
  const games = gamesAreReady ? snapshot?.weekGames ?? [] : [];
  const pickerClickerWeekState =
    pickerClickerHistory[getPickerClickerWeekId(season, currentWeek)] ?? null;

  const pickProgress = useMemo(() => {
    let explicitCount = 0;
    let openMissingCount = 0;
    let lockedMissingCount = 0;

    for (const game of games) {
      const hasManualPick = Boolean(
        selectedPlayerId && picks[selectedPlayerId]?.[game.id],
      );
      const hasDeliberatePickerClicker = Boolean(
        selectedPlayerId &&
          pickerClickerWeekState &&
          isPlayerPickerClickerSelected(
            pickerClickerWeekState,
            selectedPlayerId,
            game.id,
          ),
      );
      const hasExplicitIntent = hasManualPick || hasDeliberatePickerClicker;
      const locked = PickLockEngine.isPickLocked(game);

      if (hasExplicitIntent) {
        explicitCount += 1;
      } else if (locked) {
        lockedMissingCount += 1;
      } else {
        openMissingCount += 1;
      }
    }

    return {
      explicitCount,
      openMissingCount,
      lockedMissingCount,
      totalCount: games.length,
    };
  }, [games, pickerClickerWeekState, picks, selectedPlayerId]);

  const target = useMemo(() => {
    if (!accountLink || !selectedPlayerId) {
      return null;
    }

    return {
      leagueId: accountLink.leagueId,
      playerId: selectedPlayerId,
      week: currentWeek,
    };
  }, [accountLink, currentWeek, selectedPlayerId]);

  const loadSubmission = useCallback(
    async (showLoading: boolean) => {
      const client = supabaseClient;
      if (!client || !target || !canReadSelectedSubmission) {
        requestIdRef.current += 1;
        setSubmission(null);
        setLoading(false);
        return;
      }

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      if (showLoading) {
        setLoading(true);
      }

      try {
        const nextSubmission = await loadCloudWeeklyPickSubmission(
          client,
          target,
        );
        if (requestId === requestIdRef.current) {
          setSubmission(nextSubmission);
          setMessage(null);
        }
      } catch (error) {
        if (requestId === requestIdRef.current) {
          setMessage(getErrorMessage(error));
        }
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [canReadSelectedSubmission, target],
  );

  useEffect(() => {
    void loadSubmission(true);

    if (!canReadSelectedSubmission) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      void loadSubmission(false);
    }, STATUS_REFRESH_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
      requestIdRef.current += 1;
    };
  }, [canReadSelectedSubmission, loadSubmission]);

  const handleSubmit = async () => {
    const client = supabaseClient;
    if (!client || !target || !isViewingOwnPlayer) {
      return;
    }

    setWorkingAction("submit");
    setMessage(null);
    try {
      const nextSubmission = await submitCloudWeeklyPicks(client, target);
      setSubmission(nextSubmission);
      setMessage("Week submitted to the shared league cloud.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setWorkingAction(null);
    }
  };

  const handleReopen = async () => {
    const client = supabaseClient;
    if (!client || !target || !isCommissioner || !submission) {
      return;
    }

    setWorkingAction("reopen");
    setMessage(null);
    try {
      const nextSubmission = await reopenCloudWeeklyPickSubmission(
        client,
        target,
      );
      setSubmission(nextSubmission);
      setMessage("The weekly entry is reopened for the linked player.");
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setWorkingAction(null);
    }
  };

  const hasSubmitted = submission?.status === "submitted";
  const hasReopened = submission?.status === "reopened";
  const submitDisabled =
    !isLinked ||
    !canReadSelectedSubmission ||
    !isViewingOwnPlayer ||
    !gamesAreReady ||
    pickProgress.openMissingCount > 0 ||
    hasSubmitted ||
    workingAction !== null;
  const statusBadge = !isLinked ? (
    <SteelBadge variant="neutral">Local only</SteelBadge>
  ) : !canReadSelectedSubmission ? (
    <SteelBadge variant="neutral">Account protected</SteelBadge>
  ) : hasSubmitted ? (
    <SteelBadge variant="success">Submitted</SteelBadge>
  ) : hasReopened ? (
    <SteelBadge variant="gold">Reopened</SteelBadge>
  ) : (
    <SteelBadge variant="info">Not submitted</SteelBadge>
  );

  let description =
    "Submit only after every still-open game has a manual pick or deliberate Picker Clicker choice.";
  if (!isLinked) {
    description =
      "Sign in with a linked league account to use shared weekly submission status.";
  } else if (!canReadSelectedSubmission) {
    description =
      "The selected player has a separate protected cloud account. Switch back to your linked player to submit.";
  }

  return (
    <section className="weekly-pick-submission-shell">
      <SteelCard className="weekly-pick-submission-card" variant="gold">
        <SteelSectionHeader
          eyebrow={`Season ${season} • Week ${currentWeek}`}
          title="Weekly Pick Submission"
          description={description}
          action={statusBadge}
        />

        <div className="weekly-pick-submission-player">
          <span>Selected entry</span>
          <strong>{selectedPlayer?.name ?? "No player selected"}</strong>
          <small>
            {selectedPlayer
              ? `${selectedPlayer.nflTeam} franchise`
              : "Choose a league player below"}
          </small>
        </div>

        <div className="weekly-pick-submission-stats">
          <div>
            <span>Deliberate choices</span>
            <strong>
              {pickProgress.explicitCount}/{pickProgress.totalCount || 0}
            </strong>
          </div>
          <div>
            <span>Still open</span>
            <strong>{pickProgress.openMissingCount}</strong>
          </div>
          <div>
            <span>Locked omissions</span>
            <strong>{pickProgress.lockedMissingCount}</strong>
          </div>
        </div>

        {submission ? (
          <p className="weekly-pick-submission-timestamp">
            {submission.status === "submitted" ? "Submitted" : "Reopened"}{" "}
            {formatSubmissionTime(
              submission.status === "submitted"
                ? submission.submittedAt
                : submission.reopenedAt ?? submission.updatedAt,
            )}
          </p>
        ) : null}

        {pickProgress.lockedMissingCount > 0 ? (
          <p className="weekly-pick-submission-note">
            Locked omissions stay outside deliberate cloud intent and continue
            through the existing automatic Picker Clicker fallback rules.
          </p>
        ) : null}

        {message ? (
          <p className="weekly-pick-submission-message" role="status">
            {message}
          </p>
        ) : null}

        <div className="weekly-pick-submission-actions">
          {isViewingOwnPlayer ? (
            <SteelButton
              disabled={submitDisabled}
              onClick={() => void handleSubmit()}
              size="md"
              variant="primary"
            >
              {workingAction === "submit"
                ? "Submitting…"
                : hasSubmitted
                  ? "Week Submitted"
                  : hasReopened
                    ? "Resubmit Week"
                    : "Submit Week"}
            </SteelButton>
          ) : null}

          {isCommissioner && hasSubmitted ? (
            <SteelButton
              disabled={workingAction !== null}
              onClick={() => void handleReopen()}
              size="md"
              variant="secondary"
            >
              {workingAction === "reopen" ? "Reopening…" : "Reopen Entry"}
            </SteelButton>
          ) : null}

          {canReadSelectedSubmission ? (
            <SteelButton
              disabled={loading || workingAction !== null}
              onClick={() => void loadSubmission(true)}
              size="sm"
              variant="ghost"
            >
              {loading ? "Checking…" : "Refresh Status"}
            </SteelButton>
          ) : null}
        </div>
      </SteelCard>
    </section>
  );
}
