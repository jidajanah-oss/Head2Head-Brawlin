import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

import { useLeague } from "./LeagueContext";
import {
  createFutureSeasonPlan,
  getFutureSeasonPlanSummary,
  markFutureSeasonPlanReady,
  markFutureSeasonPlayerInactive,
  markFutureSeasonPlayerReturning,
  reopenFutureSeasonPlan,
  replaceFutureSeasonPlayer,
  updateFutureSeasonPlanDetails,
  updateFutureSeasonPlayerPlan,
  validateFutureSeasonPlan,
} from "../engine/futureSeasonEngine";
import type {
  FutureSeasonPlanDetailsUpdate,
  FutureSeasonPlayerPlanUpdate,
  FutureSeasonReplacementInput,
} from "../engine/futureSeasonEngine";
import {
  loadPersistedFutureSeasonState,
  savePersistedFutureSeasonState,
} from "../engine/futureSeasonPersistence";
import type {
  FutureSeasonPersistenceState,
  FutureSeasonPlanHistory,
} from "../engine/futureSeasonPersistence";
import type {
  FutureSeasonPlan,
  FutureSeasonValidationResult,
} from "../engine/futureSeasonTypes";

type FutureSeasonPlanSummary = ReturnType<
  typeof getFutureSeasonPlanSummary
>;

type FutureSeasonContextValue = {
  plans: FutureSeasonPlan[];
  planHistory: FutureSeasonPlanHistory;
  activePlanId: string | null;
  activePlan: FutureSeasonPlan | null;
  activeValidation: FutureSeasonValidationResult | null;
  activeSummary: FutureSeasonPlanSummary | null;

  createPlan: (
    targetSeason?: number,
  ) => FutureSeasonPlan;

  setActivePlanId: (
    planId: string | null,
  ) => void;

  updatePlanDetails: (
    planId: string,
    updates: FutureSeasonPlanDetailsUpdate,
  ) => void;

  updatePlayerPlan: (
    planId: string,
    sourcePlayerId: string,
    updates: FutureSeasonPlayerPlanUpdate,
  ) => void;

  markPlayerReturning: (
    planId: string,
    sourcePlayerId: string,
  ) => void;

  markPlayerInactive: (
    planId: string,
    sourcePlayerId: string,
  ) => void;

  replacePlayer: (
    planId: string,
    sourcePlayerId: string,
    replacement: FutureSeasonReplacementInput,
  ) => void;

  markPlanReady: (
    planId: string,
  ) => void;

  reopenPlan: (
    planId: string,
  ) => void;

  deletePlan: (
    planId: string,
  ) => void;
};

const FutureSeasonContext = createContext<
  FutureSeasonContextValue | undefined
>(undefined);

function getPlanOrThrow(
  state: FutureSeasonPersistenceState,
  planId: string,
): FutureSeasonPlan {
  const normalizedPlanId = planId.trim();

  if (!normalizedPlanId) {
    throw new Error(
      "Select a future-season plan first.",
    );
  }

  const plan = state.plans[normalizedPlanId];

  if (!plan) {
    throw new Error(
      "The selected future-season plan could not be found.",
    );
  }

  return plan;
}

function replaceStoredPlan(
  state: FutureSeasonPersistenceState,
  previousPlanId: string,
  nextPlan: FutureSeasonPlan,
): FutureSeasonPersistenceState {
  const nextPlans = {
    ...state.plans,
  };

  if (
    nextPlan.id !== previousPlanId &&
    nextPlans[nextPlan.id]
  ) {
    throw new Error(
      `A future-season plan for ${nextPlan.targetSeason} already exists.`,
    );
  }

  delete nextPlans[previousPlanId];
  nextPlans[nextPlan.id] = nextPlan;

  return {
    activePlanId:
      state.activePlanId === previousPlanId
        ? nextPlan.id
        : state.activePlanId,
    plans: nextPlans,
  };
}

function getNextActivePlanId(
  plans: FutureSeasonPlanHistory,
): string | null {
  const nextPlan = Object.values(plans).sort(
    (left, right) => {
      const seasonDifference =
        left.targetSeason -
        right.targetSeason;

      if (seasonDifference !== 0) {
        return seasonDifference;
      }

      return right.updatedAt.localeCompare(
        left.updatedAt,
      );
    },
  )[0];

  return nextPlan?.id ?? null;
}

export function FutureSeasonProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { league } = useLeague();

  const [
    persistenceState,
    setPersistenceState,
  ] = useState<FutureSeasonPersistenceState>(
    loadPersistedFutureSeasonState,
  );

  useEffect(() => {
    savePersistedFutureSeasonState(
      persistenceState,
    );
  }, [persistenceState]);

  const plans = useMemo(
    () =>
      Object.values(
        persistenceState.plans,
      ).sort((left, right) => {
        const seasonDifference =
          left.targetSeason -
          right.targetSeason;

        if (seasonDifference !== 0) {
          return seasonDifference;
        }

        return right.updatedAt.localeCompare(
          left.updatedAt,
        );
      }),
    [persistenceState.plans],
  );

  const activePlan =
    persistenceState.activePlanId
      ? persistenceState.plans[
          persistenceState.activePlanId
        ] ?? null
      : null;

  const activeValidation = useMemo(
    () =>
      activePlan
        ? validateFutureSeasonPlan(
            activePlan,
          )
        : null,
    [activePlan],
  );

  const activeSummary = useMemo(
    () =>
      activePlan
        ? getFutureSeasonPlanSummary(
            activePlan,
          )
        : null,
    [activePlan],
  );

  const createPlan = (
    targetSeason?: number,
  ): FutureSeasonPlan => {
    const plan = createFutureSeasonPlan({
      league,
      targetSeason,
    });

    if (persistenceState.plans[plan.id]) {
      throw new Error(
        `A future-season plan for ${plan.targetSeason} already exists.`,
      );
    }

    setPersistenceState(
      (previousState) => ({
        activePlanId: plan.id,
        plans: {
          ...previousState.plans,
          [plan.id]: plan,
        },
      }),
    );

    return plan;
  };

  const setActivePlanId = (
    planId: string | null,
  ) => {
    if (planId === null) {
      setPersistenceState(
        (previousState) => ({
          ...previousState,
          activePlanId: null,
        }),
      );

      return;
    }

    const normalizedPlanId = planId.trim();

    if (
      !normalizedPlanId ||
      !persistenceState.plans[
        normalizedPlanId
      ]
    ) {
      throw new Error(
        "The selected future-season plan could not be found.",
      );
    }

    setPersistenceState(
      (previousState) => ({
        ...previousState,
        activePlanId: normalizedPlanId,
      }),
    );
  };

  const updatePlanDetails = (
    planId: string,
    updates: FutureSeasonPlanDetailsUpdate,
  ) => {
    const currentPlan = getPlanOrThrow(
      persistenceState,
      planId,
    );

    const nextPlan =
      updateFutureSeasonPlanDetails(
        currentPlan,
        updates,
      );

    if (
      nextPlan.id !== currentPlan.id &&
      persistenceState.plans[nextPlan.id]
    ) {
      throw new Error(
        `A future-season plan for ${nextPlan.targetSeason} already exists.`,
      );
    }

    setPersistenceState(
      (previousState) =>
        replaceStoredPlan(
          previousState,
          currentPlan.id,
          nextPlan,
        ),
    );
  };

  const updatePlayerPlan = (
    planId: string,
    sourcePlayerId: string,
    updates: FutureSeasonPlayerPlanUpdate,
  ) => {
    const currentPlan = getPlanOrThrow(
      persistenceState,
      planId,
    );

    const nextPlan =
      updateFutureSeasonPlayerPlan(
        currentPlan,
        sourcePlayerId,
        updates,
      );

    setPersistenceState(
      (previousState) =>
        replaceStoredPlan(
          previousState,
          currentPlan.id,
          nextPlan,
        ),
    );
  };

  const markPlayerReturning = (
    planId: string,
    sourcePlayerId: string,
  ) => {
    const currentPlan = getPlanOrThrow(
      persistenceState,
      planId,
    );

    const nextPlan =
      markFutureSeasonPlayerReturning(
        currentPlan,
        sourcePlayerId,
      );

    setPersistenceState(
      (previousState) =>
        replaceStoredPlan(
          previousState,
          currentPlan.id,
          nextPlan,
        ),
    );
  };

  const markPlayerInactive = (
    planId: string,
    sourcePlayerId: string,
  ) => {
    const currentPlan = getPlanOrThrow(
      persistenceState,
      planId,
    );

    const nextPlan =
      markFutureSeasonPlayerInactive(
        currentPlan,
        sourcePlayerId,
      );

    setPersistenceState(
      (previousState) =>
        replaceStoredPlan(
          previousState,
          currentPlan.id,
          nextPlan,
        ),
    );
  };

  const replacePlayer = (
    planId: string,
    sourcePlayerId: string,
    replacement:
      FutureSeasonReplacementInput,
  ) => {
    const currentPlan = getPlanOrThrow(
      persistenceState,
      planId,
    );

    const nextPlan =
      replaceFutureSeasonPlayer(
        currentPlan,
        sourcePlayerId,
        replacement,
      );

    setPersistenceState(
      (previousState) =>
        replaceStoredPlan(
          previousState,
          currentPlan.id,
          nextPlan,
        ),
    );
  };

  const markPlanReady = (
    planId: string,
  ) => {
    const currentPlan = getPlanOrThrow(
      persistenceState,
      planId,
    );

    const nextPlan =
      markFutureSeasonPlanReady(
        currentPlan,
      );

    setPersistenceState(
      (previousState) =>
        replaceStoredPlan(
          previousState,
          currentPlan.id,
          nextPlan,
        ),
    );
  };

  const reopenPlan = (
    planId: string,
  ) => {
    const currentPlan = getPlanOrThrow(
      persistenceState,
      planId,
    );

    const nextPlan =
      reopenFutureSeasonPlan(
        currentPlan,
      );

    setPersistenceState(
      (previousState) =>
        replaceStoredPlan(
          previousState,
          currentPlan.id,
          nextPlan,
        ),
    );
  };

  const deletePlan = (
    planId: string,
  ) => {
    const normalizedPlanId = planId.trim();

    if (
      !normalizedPlanId ||
      !persistenceState.plans[
        normalizedPlanId
      ]
    ) {
      return;
    }

    setPersistenceState(
      (previousState) => {
        const nextPlans = {
          ...previousState.plans,
        };

        delete nextPlans[normalizedPlanId];

        return {
          activePlanId:
            previousState.activePlanId ===
            normalizedPlanId
              ? getNextActivePlanId(
                  nextPlans,
                )
              : previousState.activePlanId,
          plans: nextPlans,
        };
      },
    );
  };

  return (
    <FutureSeasonContext.Provider
      value={{
        plans,
        planHistory:
          persistenceState.plans,
        activePlanId:
          persistenceState.activePlanId,
        activePlan,
        activeValidation,
        activeSummary,
        createPlan,
        setActivePlanId,
        updatePlanDetails,
        updatePlayerPlan,
        markPlayerReturning,
        markPlayerInactive,
        replacePlayer,
        markPlanReady,
        reopenPlan,
        deletePlan,
      }}
    >
      {children}
    </FutureSeasonContext.Provider>
  );
}

export function useFutureSeasons() {
  const context = useContext(
    FutureSeasonContext,
  );

  if (!context) {
    throw new Error(
      "useFutureSeasons must be used within FutureSeasonProvider",
    );
  }

  return context;
}