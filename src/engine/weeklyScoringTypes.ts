export type WeeklyScoringOutcome =
  | "win"
  | "loss"
  | "tie"
  | "bye"
  | "open";

export type WeeklyScoringMatchupType =
  | "owned-opponent"
  | "open-opponent"
  | "bye";

export type WeeklyScoringMatchupStatus =
  | "final"
  | "bye"
  | "open";

export type WeeklyPlayerScoringResult = {
  playerId: string;
  playerName: string;
  nflTeam: string;
  matchupId: string;
  matchupType: WeeklyScoringMatchupType;
  opponentId: string | null;
  opponentName: string;

  /**
   * Effective score used for the weekly H2H matchup.
   * This may include deliberate or automatic Picker Clicker picks.
   */
  correctPicks: number;
  possiblePicks: number;
  missingPicks: number;

  /**
   * Correct picks eligible for the season correct-pick award.
   * This is zero when automatic Picker Clicker fallback made the
   * player ineligible for the week. Deliberate player-selected
   * Picker Clicker choices remain eligible.
   */
  seasonEligibleCorrectPicks?: number;

  weeklyPrizeEligible?: boolean;

  /**
   * Legacy automatic-fallback flag retained for compatibility.
   * This is true only when automatic Picker Clicker assistance was used.
   */
  usedPickerClicker?: boolean;

  /**
   * Number of games resolved through automatic Picker Clicker fallback.
   */
  pickerClickerFallbackCount?: number;

  /**
   * Number of games deliberately submitted with the player-selected
   * Picker Clicker third choice.
   */
  playerSelectedPickerClickerCount?: number;

  outcome: WeeklyScoringOutcome;
  leaguePointsAwarded: number;
};

export type FinalizedWeeklyMatchupRecord = {
  id: string;
  season: number;
  week: number;
  matchupId: string;
  matchupType: WeeklyScoringMatchupType;
  sourceGameId?: string;
  playerAId: string;
  playerAName: string;
  playerATeam: string;
  playerBId: string | null;
  playerBName: string | null;
  playerBTeam: string | null;
  playerAScore: number;
  playerBScore: number;
  possiblePoints: number;
  winnerId: string | null;
  isTie: boolean;
  status: WeeklyScoringMatchupStatus;
  resultLabel: string;
};

export type FinalizedWeeklyScoringRecord = {
  id: string;
  season: number;
  week: number;
  finalizedAt: string;
  totalScheduledGames: number;
  completedGameCount: number;
  canceledGameCount: number;
  eligibleScoringGameCount: number;
  completedGameIds: string[];
  canceledGameIds: string[];
  matchups: FinalizedWeeklyMatchupRecord[];
  playerResults: Record<
    string,
    WeeklyPlayerScoringResult
  >;
};

export type WeeklyScoringHistory = Record<
  string,
  FinalizedWeeklyScoringRecord
>;

export type SeasonPlayerScoringSummary = {
  playerId: string;
  playerName: string;
  nflTeam: string;
  wins: number;
  losses: number;
  ties: number;
  leaguePoints: number;

  /**
   * Award-eligible correct picks only.
   * Deliberate player-selected Picker Clicker choices count normally.
   * A week with automatic fallback contributes zero.
   */
  seasonCorrectPicks: number;

  /**
   * All effective correct picks used in H2H scoring,
   * including deliberate and automatic Picker Clicker selections.
   */
  headToHeadCorrectPicks?: number;

  seasonPossiblePicks: number;
  seasonMissingPicks: number;
  completedHeadToHeadWeeks: number;
  byeWeeks: number;
  openOpponentWeeks: number;

  /**
   * Legacy count of weeks using automatic Picker Clicker fallback.
   */
  pickerClickerWeeks?: number;

  /**
   * Explicit count of weeks using automatic Picker Clicker fallback.
   */
  automaticPickerClickerWeeks?: number;

  /**
   * Number of weeks containing at least one deliberate player-selected
   * Picker Clicker choice.
   */
  playerSelectedPickerClickerWeeks?: number;

  /**
   * Total deliberate player-selected Picker Clicker game choices.
   */
  playerSelectedPickerClickerGames?: number;

  weeklyPrizeIneligibleWeeks?: number;
};

export function getWeeklyScoringRecordId(
  season: number,
  week: number
) {
  return `${season}-week-${week}`;
}