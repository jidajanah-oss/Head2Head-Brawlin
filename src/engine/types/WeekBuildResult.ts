import type { WeekState } from "../../types/weekState";

export interface WeekBuildResult {
  weekState: WeekState;
  warnings: string[];
  errors: string[];
}