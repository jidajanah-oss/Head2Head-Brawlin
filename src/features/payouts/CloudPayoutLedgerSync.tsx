import {
  useEffect,
  useMemo,
  useRef,
} from "react";

import { useAuth } from "../../context/AuthContext";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  getPayoutLedgerSeasonId,
} from "../../engine/payoutLedgerEngine";
import {
  loadCloudPayoutLedgerSeason,
  saveCloudPayoutLedgerSeason,
} from "../../services/cloudPayoutLedgerService";

export default function CloudPayoutLedgerSync() {
  const {
    status,
    accountLink,
    access,
  } = useAuth();

  const {
    payoutLedgerHistory,
    replacePayoutLedgerSeasonFromCloud,
  } = useLeague();

  const { season } = useNFL();

  const hydratedKeyRef =
    useRef<string | null>(null);

  const lastQueuedSignatureRef =
    useRef<string | null>(null);

  const saveQueueRef =
    useRef<Promise<void>>(Promise.resolve());

  const leagueId =
    accountLink?.leagueId ?? null;

  const userId =
    accountLink?.userId ?? null;

  const ledgerId =
    getPayoutLedgerSeasonId(season);

  const localLedger =
    payoutLedgerHistory[ledgerId] ?? null;

  const syncKey = useMemo(() => {
    if (!leagueId || !userId) {
      return null;
    }

    return `${userId}:${leagueId}:${season}`;
  }, [
    leagueId,
    season,
    userId,
  ]);

  /*
   * Hydration rule:
   *
   * 1. Cloud data wins when it already exists.
   * 2. If cloud is empty, seed it once from the current local ledger.
   * 3. Never begin automatic cloud writes until this initial read
   *    has completed successfully.
   */
  useEffect(() => {
    if (
      status !== "signed-in-linked" ||
      !access.canManageLeague ||
      !leagueId ||
      !userId ||
      !syncKey
    ) {
      hydratedKeyRef.current = null;
      lastQueuedSignatureRef.current = null;
      return;
    }

    let cancelled = false;

    hydratedKeyRef.current = null;
    lastQueuedSignatureRef.current = null;

    const hydrate = async () => {
      try {
        const cloudLedger =
          await loadCloudPayoutLedgerSeason(
            leagueId,
            season,
          );

        if (cancelled) {
          return;
        }

        if (cloudLedger) {
          const signature =
            JSON.stringify(cloudLedger);

          lastQueuedSignatureRef.current =
            signature;

          hydratedKeyRef.current =
            syncKey;

          replacePayoutLedgerSeasonFromCloud(
            season,
            cloudLedger,
          );

          return;
        }

        if (localLedger) {
          await saveCloudPayoutLedgerSeason(
            leagueId,
            season,
            localLedger,
            userId,
          );

          if (cancelled) {
            return;
          }

          lastQueuedSignatureRef.current =
            JSON.stringify(localLedger);
        }

        hydratedKeyRef.current =
          syncKey;
      } catch (error) {
        console.error(
          "[CloudPayoutLedgerSync] Initial cloud hydration failed.",
          error,
        );
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
    // Initial hydration is intentionally keyed to the signed-in
    // commissioner/league/season, not to later local ledger edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    access.canManageLeague,
    leagueId,
    season,
    status,
    syncKey,
    userId,
  ]);

  /*
   * After hydration, serialize all ledger writes through one promise
   * queue. That prevents two quick Paid/Unpaid changes from reaching
   * Supabase out of order.
   */
  useEffect(() => {
    if (
      status !== "signed-in-linked" ||
      !access.canManageLeague ||
      !leagueId ||
      !userId ||
      !syncKey ||
      hydratedKeyRef.current !==
        syncKey ||
      !localLedger
    ) {
      return;
    }

    const signature =
      JSON.stringify(localLedger);

    if (
      lastQueuedSignatureRef.current ===
      signature
    ) {
      return;
    }

    lastQueuedSignatureRef.current =
      signature;

    const ledgerToSave =
      localLedger;

    saveQueueRef.current =
      saveQueueRef.current
        .then(() =>
          saveCloudPayoutLedgerSeason(
            leagueId,
            season,
            ledgerToSave,
            userId,
          ),
        )
        .catch((error) => {
          console.error(
            "[CloudPayoutLedgerSync] Cloud save failed.",
            error,
          );

          /*
           * Allow the same state to retry on a later render/action
           * if the network write failed.
           */
          if (
            lastQueuedSignatureRef.current ===
            signature
          ) {
            lastQueuedSignatureRef.current =
              null;
          }
        });
  }, [
    access.canManageLeague,
    leagueId,
    localLedger,
    season,
    status,
    syncKey,
    userId,
  ]);

  return null;
}