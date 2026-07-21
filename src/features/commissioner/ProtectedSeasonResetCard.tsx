import {
  useMemo,
  useState,
} from "react";
import {
  SteelBadge,
  SteelButton,
  SteelCard,
  SteelSectionHeader,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import {
  applyLocalSeasonResetIfNeeded,
  resetCurrentSeasonTestData,
} from "../../services/cloudSeasonResetService";
import { supabaseClient } from "../../services/supabaseClient";
import "../../styles/protected-season-reset.css";

const RESET_CONFIRMATION =
  "RESET 2026";

function getErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : "Unable to reset the 2026 test data.";
}

function ProtectedSeasonResetCard() {
  const {
    status,
    accountLink,
  } = useAuth();

  const { league } = useLeague();

  const [
    confirmation,
    setConfirmation,
  ] = useState("");

  const [
    resetting,
    setResetting,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const season = useMemo(
    () =>
      Number.parseInt(
        String(
          league.settings.season,
        ),
        10,
      ),
    [league.settings.season],
  );

  const isPrimaryCommissioner =
    status === "signed-in-linked" &&
    accountLink?.role ===
      "commissioner";

  const confirmationMatches =
    confirmation ===
    RESET_CONFIRMATION;

  const resetSeason = async () => {
    const client = supabaseClient;

    if (
      !client ||
      !accountLink ||
      !isPrimaryCommissioner ||
      season !== 2026 ||
      !confirmationMatches ||
      resetting
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        "This permanently removes all 2026 test picks, submissions, Picker Clicker assignments, scoring records, and test game results. The roster, linked accounts, invitations, roles, payout ledger, and 2027 planning are preserved. Continue?",
      );

    if (!confirmed) {
      return;
    }

    setResetting(true);
    setErrorMessage(null);

    try {
      const reset =
        await resetCurrentSeasonTestData(
          client,
          accountLink.leagueId,
          confirmation,
        );

      applyLocalSeasonResetIfNeeded(
        reset,
      );

      window.location.reload();
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
      setResetting(false);
    }
  };

  return (
    <SteelCard
      className="protected-season-reset-card"
      as="section"
    >
      <SteelSectionHeader
        eyebrow="Primary Commissioner Safety"
        title="Reset 2026 Test Data"
        description="Return the active league to Week 1 and remove testing activity before the real season begins."
        action={
          <SteelBadge
            variant={
              isPrimaryCommissioner
                ? "danger"
                : "neutral"
            }
          >
            {isPrimaryCommissioner
              ? "Jimbo Only"
              : "Primary Only"}
          </SteelBadge>
        }
      />

      <div className="protected-season-reset-card__preserved">
        <strong>Preserved</strong>
        <p>
          All 32 players, NFL franchises,
          linked accounts, login emails,
          invitations, commissioner roles,
          payout records, league rules, and
          paused 2027 planning.
        </p>
      </div>

      <div className="protected-season-reset-card__cleared">
        <strong>Cleared</strong>
        <p>
          Test picks, weekly submissions,
          Picker Clicker assignments,
          opponent-reveal eligibility,
          scoring records, test game results,
          standings progress, awards progress,
          playoff results, and active week.
        </p>
      </div>

      {isPrimaryCommissioner ? (
        <div className="protected-season-reset-card__controls">
          <label
            htmlFor="protected-season-reset-confirmation"
          >
            Type{" "}
            <code>
              {RESET_CONFIRMATION}
            </code>
          </label>

          <input
            id="protected-season-reset-confirmation"
            type="text"
            value={confirmation}
            autoComplete="off"
            spellCheck={false}
            disabled={resetting}
            onChange={(event) => {
              setConfirmation(
                event.target.value,
              );
              setErrorMessage(null);
            }}
          />

          <SteelButton
            className="protected-season-reset-card__button"
            type="button"
            variant="danger"
            size="lg"
            disabled={
              !confirmationMatches ||
              resetting ||
              season !== 2026
            }
            onClick={() => {
              void resetSeason();
            }}
          >
            {resetting
              ? "Creating Audit & Resetting..."
              : "Reset 2026 Test Data"}
          </SteelButton>
        </div>
      ) : (
        <p className="protected-season-reset-card__locked">
          Backup commissioners can view this
          safeguard, but only Jimbo&apos;s
          primary commissioner account can run
          it.
        </p>
      )}

      {errorMessage ? (
        <p
          className="protected-season-reset-card__error"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}

      <p className="protected-season-reset-card__note">
        A permanent cloud audit snapshot is
        created before anything is deleted.
        Every linked device receives the reset
        marker and clears its stale local test
        state when it next opens the app.
      </p>
    </SteelCard>
  );
}

export default ProtectedSeasonResetCard;
