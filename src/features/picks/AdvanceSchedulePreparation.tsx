import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import { NFLService } from "../../engine/nfl/NFLService";
import { usePickerClickerCloudAuthority } from "../../services/pickerClickerCloudAuthorityService";
import { supabaseClient } from "../../services/supabaseClient";
import { synchronizeCloudLeagueGames } from "../../services/cloudLeagueGameService";
import { loadCloudLeagueRoster } from "../../services/cloudLeagueRosterService";
import { createCloudPickerClickerWeekAssignment, loadCloudPickerClickerWeekAssignments } from "../../services/cloudPickerClickerAssignmentService";
import { getAssignmentCreationCandidate } from "../auth/CloudPickerClickerAssignmentSync";
import { advancePickWeeks } from "./advancePickWeeks";

// Prepare in week order so the existing nonrepeating Picker Clicker cycle is preserved.
export default function AdvanceSchedulePreparation() {
  const { accountLink, access, status } = useAuth();
  const { league } = useLeague();
  const { season } = useNFL();
  const authority = usePickerClickerCloudAuthority(season, league.currentWeek, accountLink?.leagueId);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const client = supabaseClient;
    if (!client || !accountLink || !access.canManageLeague || status !== "signed-in-linked" ||
        accountLink.season !== season || authority.status !== "ready") return;
    let canceled = false;
    let running = false;
    async function prepare() {
      if (running || canceled || !client || !accountLink) return;
      running = true;
      try {
        const cloudPlayers = await loadCloudLeagueRoster(client, accountLink.leagueId);
        for (const week of advancePickWeeks(league.currentWeek).slice(1)) {
          const snapshot = await NFLService.loadWeek(season, week);
          if (canceled) return;
          if (!snapshot.nflGames.length) throw new Error(`Week ${week} schedule is not available yet.`);
          await synchronizeCloudLeagueGames(client, accountLink.leagueId, snapshot.nflGames);
          const cloudAssignments = await loadCloudPickerClickerWeekAssignments(client, accountLink.leagueId, season);
          if (canceled) return;
          if (!cloudAssignments.some(value => value.week === week)) {
            const candidate = getAssignmentCreationCandidate({ cloudAssignments, cloudPlayers, season, week });
            if (!candidate) throw new Error(`Week ${week} Picker Clicker source could not be prepared.`);
            await createCloudPickerClickerWeekAssignment(client, { leagueId: accountLink.leagueId, season, week, ...candidate });
          }
        }
        if (!canceled) setError(null);
      } catch (err) {
        if (!canceled) setError(err instanceof Error ? err.message : "Advance schedules could not be prepared.");
      } finally { running = false; }
    }
    void prepare();
    const timer = window.setInterval(() => { void prepare(); }, 60_000);
    return () => { canceled = true; window.clearInterval(timer); };
  }, [accountLink, access.canManageLeague, status, season, league.currentWeek, authority.status]);
  return error && access.canManageLeague ? <p role="status">Advance Picks preparation: {error} Retrying automatically.</p> : null;
}
