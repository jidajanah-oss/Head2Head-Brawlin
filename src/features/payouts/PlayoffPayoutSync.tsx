import { useEffect } from "react";

import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  getNextPlayoffPayoutSyncAction,
  getPayoutLedgerSeasonId,
  getPlayoffSeasonId,
} from "../../engine";

function PlayoffPayoutSync() {
  const { season } = useNFL();

  const {
    playoffResultsHistory,
    payoutLedgerHistory,
    synchronizePayoutLedgerSeason,
    upsertPayoutLedgerEntry,
    removePayoutLedgerEntry,
  } = useLeague();

  const playoffSeason =
    playoffResultsHistory[
      getPlayoffSeasonId(season)
    ];

  const ledger =
    payoutLedgerHistory[
      getPayoutLedgerSeasonId(season)
    ];

  useEffect(() => {
    if (!playoffSeason) {
      return;
    }

    if (!ledger) {
      synchronizePayoutLedgerSeason(
        season,
      );
      return;
    }

    const action =
      getNextPlayoffPayoutSyncAction(
        ledger,
        playoffSeason,
      );

    if (action.type === "upsert") {
      upsertPayoutLedgerEntry(
        season,
        action.entry,
      );
      return;
    }

    if (action.type === "remove") {
      removePayoutLedgerEntry(
        season,
        action.entryId,
      );
    }
  }, [
    season,
    playoffSeason,
    ledger,
    synchronizePayoutLedgerSeason,
    upsertPayoutLedgerEntry,
    removePayoutLedgerEntry,
  ]);

  return null;
}

export default PlayoffPayoutSync;
