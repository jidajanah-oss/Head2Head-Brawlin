import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import {
  getSeasonCloseoutArchiveId,
  isSeasonClosed as checkSeasonClosed,
} from "../engine/seasonCloseoutEngine";
import {
  loadPersistedSeasonCloseoutHistory,
  savePersistedSeasonCloseoutHistory,
} from "../engine/seasonCloseoutPersistence";
import type {
  SeasonCloseoutArchive,
  SeasonCloseoutArchiveHistory,
  SeasonCloseoutLockedArea,
} from "../engine/seasonCloseoutTypes";

type SeasonCloseoutContextValue = {
  archiveHistory:
    SeasonCloseoutArchiveHistory;
  archiveCount: number;
  storeArchive: (
    archive: SeasonCloseoutArchive,
  ) => void;
  getArchive: (
    season: number,
  ) => SeasonCloseoutArchive | null;
  isSeasonClosed: (
    season: number,
  ) => boolean;
  isAreaLocked: (
    season: number,
    area: SeasonCloseoutLockedArea,
  ) => boolean;
};

const SeasonCloseoutContext =
  createContext<
    SeasonCloseoutContextValue | undefined
  >(undefined);

function cloneArchive(
  archive: SeasonCloseoutArchive,
): SeasonCloseoutArchive {
  return JSON.parse(
    JSON.stringify(archive),
  ) as SeasonCloseoutArchive;
}

export function SeasonCloseoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    archiveHistory,
    setArchiveHistory,
  ] = useState<SeasonCloseoutArchiveHistory>(
    loadPersistedSeasonCloseoutHistory,
  );

  useEffect(() => {
    savePersistedSeasonCloseoutHistory(
      archiveHistory,
    );
  }, [archiveHistory]);

  const archiveCount = useMemo(
    () =>
      Object.keys(archiveHistory).length,
    [archiveHistory],
  );

  const storeArchive = (
    archive: SeasonCloseoutArchive,
  ) => {
    const archiveId =
      getSeasonCloseoutArchiveId(
        archive.season,
      );

    if (archiveHistory[archiveId]) {
      throw new Error(
        `Season ${archive.season} is already closed and archived.`,
      );
    }

    const archivedCopy =
      cloneArchive(archive);

    setArchiveHistory(
      (previousHistory) => {
        if (
          previousHistory[archiveId]
        ) {
          return previousHistory;
        }

        return {
          ...previousHistory,
          [archiveId]: {
            ...archivedCopy,
            id: archiveId,
          },
        };
      },
    );
  };

  const getArchive = (
    season: number,
  ) =>
    archiveHistory[
      getSeasonCloseoutArchiveId(
        season,
      )
    ] ?? null;

  const isSeasonClosed = (
    season: number,
  ) =>
    checkSeasonClosed(
      archiveHistory,
      season,
    );

  const isAreaLocked = (
    season: number,
    area: SeasonCloseoutLockedArea,
  ) => {
    const archive =
      getArchive(season);

    return Boolean(
      archive?.lockScope.includes(area),
    );
  };

  return (
    <SeasonCloseoutContext.Provider
      value={{
        archiveHistory,
        archiveCount,
        storeArchive,
        getArchive,
        isSeasonClosed,
        isAreaLocked,
      }}
    >
      {children}
    </SeasonCloseoutContext.Provider>
  );
}

export function useSeasonCloseout() {
  const context = useContext(
    SeasonCloseoutContext,
  );

  if (!context) {
    throw new Error(
      "useSeasonCloseout must be used within SeasonCloseoutProvider",
    );
  }

  return context;
}
