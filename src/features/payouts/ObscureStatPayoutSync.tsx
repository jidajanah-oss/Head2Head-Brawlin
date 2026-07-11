import { useEffect } from "react";
import { useLeague } from "../../context/LeagueContext";
import { useObscureStat } from "../../context/ObscureStatContext";
import {
  getObscureStatPayoutSyncAction,
  getPayoutLedgerSeasonId,
} from "../../engine";

function ObscureStatPayoutSync() {
  const { result } = useObscureStat();
  const {
    payoutLedgerHistory,
    synchronizePayoutLedgerSeason,
    upsertPayoutLedgerEntry,
    removePayoutLedgerEntry,
  } = useLeague();

  const ledgerId = getPayoutLedgerSeasonId(
    result.season,
  );

  const ledger =
    payoutLedgerHistory[ledgerId];

  useEffect(() => {
    if (!ledger) {
      synchronizePayoutLedgerSeason(
        result.season,
      );
      return;
    }

    const action =
      getObscureStatPayoutSyncAction(
        ledger,
        result,
      );

    if (action.type === "upsert") {
      upsertPayoutLedgerEntry(
        result.season,
        action.entry,
      );
      return;
    }

    if (action.type === "remove") {
      removePayoutLedgerEntry(
        result.season,
        action.entryId,
      );
    }
  }, [
    ledger,
    removePayoutLedgerEntry,
    result,
    synchronizePayoutLedgerSeason,
    upsertPayoutLedgerEntry,
  ]);

  return null;
}

export default ObscureStatPayoutSync;
