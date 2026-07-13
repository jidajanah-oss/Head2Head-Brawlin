import {
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";

import ObscureStatAwardCard from "../features/awards/ObscureStatAwardCard";
import SeasonAwardsBoard from "../features/awards/SeasonAwardsBoard";
import PublicPlayoffResults from "../features/playoffs/PublicPlayoffResults";
import StandingsBoard from "../features/standings/StandingsBoard";

import "../styles/standings.css";

function ObscureStatAwardAfterPickerClicker() {
  const [portalTarget, setPortalTarget] =
    useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const pickerClickerCard =
      document.querySelector<HTMLElement>(
        ".standings-picker-clicker-card",
      );

    if (!pickerClickerCard) {
      return;
    }

    const portalHost = document.createElement("div");

    portalHost.className =
      "standings-obscure-stat-portal";
    portalHost.style.display = "contents";

    pickerClickerCard.insertAdjacentElement(
      "afterend",
      portalHost,
    );

    setPortalTarget(portalHost);

    return () => {
      portalHost.remove();
    };
  }, []);

  if (!portalTarget) {
    return null;
  }

  return createPortal(
    <ObscureStatAwardCard />,
    portalTarget,
  );
}

function Standings() {
  return (
    <>
      <SeasonAwardsBoard />
      <PublicPlayoffResults />
      <StandingsBoard />
      <ObscureStatAwardAfterPickerClicker />
    </>
  );
}

export default Standings;
