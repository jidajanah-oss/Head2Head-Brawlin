import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import {
  SteelBadge,
  SteelCard,
  SteelHero,
  SteelSectionHeader,
  SteelStatCard,
} from "../../components/steel";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import {
  buildSeasonPlayerScoringSummaries,
  getNFLTeamDisplayName,
  getNFLTeamInfo,
  getWeeklyScoringRecordId,
  type WeeklyPlayerScoringResult,
  type WeeklyScoringOutcome,
} from "../../engine";
import type {
  Player,
  PlayerRole,
} from "../../types/player";

function getSeasonNumber(
  seasonValue: string | number,
): number {
  const parsedSeason = Number.parseInt(
    String(seasonValue),
    10,
  );

  if (
    Number.isInteger(parsedSeason) &&
    parsedSeason > 0
  ) {
    return parsedSeason;
  }

  return new Date().getFullYear();
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

function getRoleBadgeVariant(
  role: PlayerRole,
): "gold" | "info" | "neutral" {
  if (role === "commissioner") {
    return "gold";
  }

  if (role === "backup_commissioner") {
    return "info";
  }

  return "neutral";
}

function getOutcomeLabel(
  outcome: WeeklyScoringOutcome | undefined,
): string {
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
    return "Bye Week";
  }

  if (outcome === "open") {
    return "Open Opponent";
  }

  return "Pending";
}

function getOutcomeBadgeVariant(
  outcome: WeeklyScoringOutcome | undefined,
): "success" | "danger" | "info" | "neutral" {
  if (outcome === "win") {
    return "success";
  }

  if (outcome === "loss") {
    return "danger";
  }

  if (outcome === "tie") {
    return "info";
  }

  return "neutral";
}

function getPlayerTeamDescription(
  player: Player,
): string {
  const teamInfo = getNFLTeamInfo(player.nflTeam);

  if (!teamInfo) {
    return "NFL franchise";
  }

  return `${teamInfo.conference} • ${teamInfo.division}`;
}

function getWeeklyPickerClickerLabel(
  result: WeeklyPlayerScoringResult,
): string {
  const automaticCount =
    result.pickerClickerFallbackCount ?? 0;
  const selectedCount =
    result.playerSelectedPickerClickerCount ?? 0;

  if (automaticCount > 0) {
    return `Automatic • ${automaticCount}`;
  }

  if (selectedCount > 0) {
    return `Selected • ${selectedCount}`;
  }

  return "Not Used";
}

function getWeeklyPickerClickerHelper(
  result: WeeklyPlayerScoringResult,
): string {
  const automaticCount =
    result.pickerClickerFallbackCount ?? 0;
  const selectedCount =
    result.playerSelectedPickerClickerCount ?? 0;

  if (automaticCount > 0) {
    return "H2H credit only • award week excluded";
  }

  if (selectedCount > 0) {
    return "Normal credit • prize eligible";
  }

  return "Normal season credit";
}

function getCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${
    count === 1 ? singular : plural
  }`;
}

export default function MyFranchiseProfile() {
  const { status, accountLink } = useAuth();
  const {
    league,
    scoringHistory,
  } = useLeague();

  if (
    status !== "signed-in-linked" ||
    !accountLink
  ) {
    return null;
  }

  const player = league.players.find(
    (candidate) =>
      candidate.id === accountLink.playerId,
  );

  if (!player) {
    return (
      <SteelCard
        as="section"
        className="my-franchise-profile my-franchise-profile--missing"
        variant="danger"
      >
        <SteelSectionHeader
          eyebrow="My Franchise"
          title="Player profile unavailable"
          description="Your cloud account is linked, but the matching player is not available in the current local roster. Refresh the cloud account below before continuing."
          action={
            <SteelBadge variant="danger">
              Needs Refresh
            </SteelBadge>
          }
        />
      </SteelCard>
    );
  }

  const season = getSeasonNumber(
    league.settings.season,
  );

  const seasonSummaries =
    buildSeasonPlayerScoringSummaries({
      players: league.players,
      scoringHistory,
      season,
      throughWeek: league.currentWeek,
    });

  const seasonSummary =
    seasonSummaries[player.id];

  const currentWeekRecord =
    scoringHistory[
      getWeeklyScoringRecordId(
        season,
        league.currentWeek,
      )
    ];

  const currentWeekResult =
    currentWeekRecord?.playerResults[player.id];

  const teamInfo = getNFLTeamInfo(
    player.nflTeam,
  );

  const recordLabel = [
    seasonSummary?.wins ?? 0,
    seasonSummary?.losses ?? 0,
    seasonSummary?.ties ?? 0,
  ].join("-");

  const seasonCorrectPicks =
    seasonSummary?.seasonCorrectPicks ?? 0;

  const seasonPossiblePicks =
    seasonSummary?.seasonPossiblePicks ?? 0;

  const completedWeeks =
    seasonSummary?.completedHeadToHeadWeeks ?? 0;

  const leaguePoints =
    seasonSummary?.leaguePoints ?? 0;

  const playerSelectedPickerClickerWeeks =
    seasonSummary
      ?.playerSelectedPickerClickerWeeks ?? 0;

  const playerSelectedPickerClickerGames =
    seasonSummary
      ?.playerSelectedPickerClickerGames ?? 0;

  const automaticPickerClickerWeeks =
    seasonSummary
      ?.automaticPickerClickerWeeks ??
    seasonSummary?.pickerClickerWeeks ??
    0;

  const weeklyPrizeIneligibleWeeks =
    seasonSummary
      ?.weeklyPrizeIneligibleWeeks ?? 0;

  return (
    <div className="my-franchise-profile">
      <SteelHero
        className="my-franchise-profile__hero"
        eyebrow="My Franchise"
        title={player.name}
        subtitle={`${player.nflTeam} • ${getNFLTeamDisplayName(
          player.nflTeam,
        )}`}
        primaryLabel="Make Picks"
        primaryHref="/picks"
        secondaryLabel="View Standings"
        secondaryHref="/standings"
        rightContent={
          <div className="my-franchise-profile__hero-card">
            <FranchiseLogo
              className="my-franchise-profile__logo"
              nflTeam={player.nflTeam}
              customLogo={player.customLogo}
              displayName={player.name}
              size="xl"
              variant="tile"
            />

            <div className="my-franchise-profile__hero-team">
              <span>Owned Franchise</span>

              <strong>
                {getNFLTeamDisplayName(
                  player.nflTeam,
                )}
              </strong>

              <small>
                {getPlayerTeamDescription(player)}
              </small>
            </div>

            <SteelBadge
              variant={getRoleBadgeVariant(
                player.role,
              )}
            >
              {getRoleLabel(player.role)}
            </SteelBadge>
          </div>
        }
      />

      <section className="my-franchise-profile__stats">
        <SteelStatCard
          label="H2H Record"
          value={recordLabel}
          helper="Wins • Losses • Ties"
          icon=""
        />

        <SteelStatCard
          label="League Points"
          value={leaguePoints}
          helper="3 win • 1 tie"
          icon=""
        />

        <SteelStatCard
          label="Correct Picks"
          value={`${seasonCorrectPicks}/${seasonPossiblePicks}`}
          helper="Season award eligible"
          icon="✓"
        />

        <SteelStatCard
          label="Completed Weeks"
          value={completedWeeks}
          helper={`Through Week ${league.currentWeek}`}
          icon=""
        />
      </section>

      <SteelCard
        as="section"
        className="my-franchise-profile__pc-card"
      >
        <SteelSectionHeader
          eyebrow="Picker Clicker"
          title="Season Usage & Award Status"
          description="Player-selected Picker Clicker choices receive normal scoring and award credit. Automatic fallback helps only with the weekly head-to-head matchup."
          action={
            <SteelBadge
              variant={
                weeklyPrizeIneligibleWeeks > 0
                  ? "danger"
                  : "success"
              }
            >
              {weeklyPrizeIneligibleWeeks > 0
                ? `${weeklyPrizeIneligibleWeeks} Award Week${
                    weeklyPrizeIneligibleWeeks === 1
                      ? ""
                      : "s"
                  } Excluded`
                : "All Weeks Eligible"}
            </SteelBadge>
          }
        />

        <div className="my-franchise-profile__pc-grid">
          <div>
            <span>Player Selected</span>

            <strong>
              {getCountLabel(
                playerSelectedPickerClickerGames,
                "game",
              )}
            </strong>

            <small>
              {getCountLabel(
                playerSelectedPickerClickerWeeks,
                "week",
              )}{" "}
              with deliberate third-choice picks
            </small>
          </div>

          <div>
            <span>Automatic Fallback</span>

            <strong>
              {getCountLabel(
                automaticPickerClickerWeeks,
                "week",
              )}
            </strong>

            <small>
              H2H credit only; those weeks do not
              count toward the season correct-pick
              award
            </small>
          </div>

          <div>
            <span>Award Weeks Excluded</span>

            <strong>
              {getCountLabel(
                weeklyPrizeIneligibleWeeks,
                "week",
              )}
            </strong>

            <small>
              Only automatic no-pick assistance
              causes an exclusion
            </small>
          </div>
        </div>
      </SteelCard>

      <SteelCard
        as="section"
        className="my-franchise-profile__week-card"
      >
        <SteelSectionHeader
          eyebrow={`Week ${league.currentWeek}`}
          title="My Weekly Matchup"
          description={
            currentWeekResult
              ? "Finalized head-to-head result for the active league week."
              : "This week has not been finalized yet."
          }
          action={
            <SteelBadge
              variant={getOutcomeBadgeVariant(
                currentWeekResult?.outcome,
              )}
            >
              {getOutcomeLabel(
                currentWeekResult?.outcome,
              )}
            </SteelBadge>
          }
        />

        {currentWeekResult ? (
          <div className="my-franchise-profile__week-grid">
            <div>
              <span>Opponent</span>

              <strong>
                {currentWeekResult.opponentName}
              </strong>

              <small>
                {currentWeekResult.matchupType ===
                "owned-opponent"
                  ? "Head-to-head matchup"
                  : currentWeekResult.matchupType ===
                      "bye"
                    ? "NFL schedule bye"
                    : "Unowned NFL opponent"}
              </small>
            </div>

            <div>
              <span>Correct Picks</span>

              <strong>
                {currentWeekResult.correctPicks}/
                {currentWeekResult.possiblePicks}
              </strong>

              <small>
                {currentWeekResult.missingPicks} missing
              </small>
            </div>

            <div>
              <span>League Points</span>

              <strong>
                {
                  currentWeekResult.leaguePointsAwarded
                }
              </strong>

              <small>
                {currentWeekResult.outcome === "win"
                  ? "Weekly win"
                  : currentWeekResult.outcome ===
                      "tie"
                    ? "Weekly tie"
                    : "No points awarded"}
              </small>
            </div>

            <div>
              <span>Picker Clicker</span>

              <strong>
                {getWeeklyPickerClickerLabel(
                  currentWeekResult,
                )}
              </strong>

              <small>
                {getWeeklyPickerClickerHelper(
                  currentWeekResult,
                )}
              </small>
            </div>
          </div>
        ) : (
          <div className="my-franchise-profile__week-pending">
            <strong>
              Week {league.currentWeek} is still open
            </strong>

            <span>
              Your opponent, pick score, and result will
              appear here after weekly scoring is
              finalized.
            </span>
          </div>
        )}

        <div className="my-franchise-profile__identity-line">
          <span>
            {player.nflTeam}
          </span>

          <strong>
            {teamInfo?.conference ?? "NFL"}
          </strong>

          <small>
            {teamInfo?.division ??
              "Franchise assignment"}
          </small>
        </div>
      </SteelCard>
    </div>
  );
}