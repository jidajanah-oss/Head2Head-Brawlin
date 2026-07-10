import { useEffect } from "react";

import { useLeague } from "../../context/LeagueContext";
import { useSeasonAwards } from "../../context/SeasonAwardContext";
import {
  getNextSeasonAwardPayoutSyncAction,
  getPayoutLedgerSeasonId,
} from "../../engine";

function SeasonAwardPayoutSync() {
  const { season, results } =
    useSeasonAwards();

  const {
    payoutLedgerHistory,
    synchronizePayoutLedgerSeason,
    upsertPayoutLedgerEntry,
    removePayoutLedgerEntry,
  } = useLeague();

  const ledger =
    payoutLedgerHistory[
      getPayoutLedgerSeasonId(season)
    ];

  useEffect(() => {
    if (!ledger) {
      synchronizePayoutLedgerSeason(
        season,
      );
      return;
    }

    const action =
      getNextSeasonAwardPayoutSyncAction(
        ledger,
        results,
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
    results,
    ledger,
    synchronizePayoutLedgerSeason,
    upsertPayoutLedgerEntry,
    removePayoutLedgerEntry,
  ]);

  return null;
}

export default SeasonAwardPayoutSync;
