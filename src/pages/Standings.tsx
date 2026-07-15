import {
  useLayoutEffect,
  useState,
} from "react";
import { createPortal } from "react-dom";
import ObscureStatAwardCard from "../features/awards/ObscureStatAwardCard";
import SeasonAwardsBoard from "../features/awards/SeasonAwardsBoard";
import PublicPlayoffResults from "../features/playoffs/PublicPlayoffResults";
import BestDivisionRace from "../features/standings/BestDivisionRace";
import StandingsBoard from "../features/standings/StandingsBoard";
import { useLeague } from "../context/LeagueContext";
import "../styles/standings.css";

function WeeklyAwardsAfterPickerClicker() {
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

    const portalHost =
      document.createElement("div");

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
    <>
      <ObscureStatAwardCard />
      <SeasonAwardsBoard />
      <PublicPlayoffResults />
    </>,
    portalTarget,
  );
}

function BestDivisionRaceAfterDivisions() {
  const [portalTarget, setPortalTarget] =
    useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    const conferenceCards = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".standings-conference-card",
      ),
    );

    const lastConferenceCard =
      conferenceCards[
        conferenceCards.length - 1
      ];

    if (!lastConferenceCard) {
      return;
    }

    const portalHost =
      document.createElement("div");

    portalHost.className =
      "standings-best-division-portal";
    portalHost.style.display = "contents";

    lastConferenceCard.insertAdjacentElement(
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
    <BestDivisionRace />,
    portalTarget,
  );
}

function getDivisionKey(
  card: HTMLElement,
  fallbackIndex: number,
) {
  const divisionLabel = card
    .querySelector<HTMLElement>(
      ".standings-division-topline span",
    )
    ?.textContent?.trim();

  return (
    divisionLabel ||
    `division-${fallbackIndex}`
  );
}

function StandingsDivisionOrganizer() {
  const { activePlayerId } = useLeague();

  useLayoutEffect(() => {
    const page =
      document.querySelector<HTMLElement>(
        ".standings-page-layout",
      );

    if (!page) {
      return;
    }

    const expandedDivisionKeys =
      new Set<string>();

    let animationFrameId: number | null =
      null;

    const synchronizeDivisionCards = () => {
      animationFrameId = null;

      const divisionCards = Array.from(
        page.querySelectorAll<HTMLElement>(
          ".standings-division-card",
        ),
      );

      const conferenceCards = Array.from(
        page.querySelectorAll<HTMLElement>(
          ".standings-conference-card",
        ),
      );

      conferenceCards.forEach(
        (conferenceCard) => {
          conferenceCard.classList.remove(
            "is-active-conference",
          );
        },
      );

      const activeDivisionCard =
        divisionCards.find((divisionCard) =>
          divisionCard.querySelector(
            ".standings-division-row.is-active-player",
          ),
        ) ?? divisionCards[0];

      if (activeDivisionCard) {
        const activeDivisionIndex =
          divisionCards.indexOf(
            activeDivisionCard,
          );

        expandedDivisionKeys.add(
          getDivisionKey(
            activeDivisionCard,
            activeDivisionIndex,
          ),
        );

        activeDivisionCard
          .closest<HTMLElement>(
            ".standings-conference-card",
          )
          ?.classList.add(
            "is-active-conference",
          );
      }

      divisionCards.forEach(
        (divisionCard, divisionIndex) => {
          const divisionKey =
            getDivisionKey(
              divisionCard,
              divisionIndex,
            );

          const divisionTopline =
            divisionCard.querySelector<HTMLElement>(
              ".standings-division-topline",
            );

          const isActiveDivision =
            divisionCard ===
            activeDivisionCard;

          const isExpanded =
            expandedDivisionKeys.has(
              divisionKey,
            );

          divisionCard.dataset.divisionKey =
            divisionKey;

          divisionCard.classList.toggle(
            "is-active-division",
            isActiveDivision,
          );

          divisionCard.classList.toggle(
            "is-expanded",
            isExpanded,
          );

          if (!divisionTopline) {
            return;
          }

          divisionTopline.classList.add(
            "standings-division-toggle",
          );

          divisionTopline.setAttribute(
            "role",
            "button",
          );

          divisionTopline.setAttribute(
            "tabindex",
            "0",
          );

          divisionTopline.setAttribute(
            "aria-expanded",
            String(isExpanded),
          );

          divisionTopline.setAttribute(
            "aria-label",
            `${
              isExpanded
                ? "Collapse"
                : "Expand"
            } ${divisionKey} standings`,
          );
        },
      );
    };

    const scheduleSynchronization = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId =
        window.requestAnimationFrame(
          synchronizeDivisionCards,
        );
    };

    const toggleDivision = (
      divisionTopline: HTMLElement,
    ) => {
      const divisionCard =
        divisionTopline.closest<HTMLElement>(
          ".standings-division-card",
        );

      if (!divisionCard) {
        return;
      }

      const divisionKey =
        divisionCard.dataset.divisionKey;

      if (!divisionKey) {
        return;
      }

      if (
        expandedDivisionKeys.has(
          divisionKey,
        )
      ) {
        expandedDivisionKeys.delete(
          divisionKey,
        );
      } else {
        expandedDivisionKeys.add(
          divisionKey,
        );
      }

      scheduleSynchronization();
    };

    const handleClick = (event: Event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const divisionTopline =
        target.closest<HTMLElement>(
          ".standings-division-toggle",
        );

      if (
        !divisionTopline ||
        !page.contains(divisionTopline)
      ) {
        return;
      }

      toggleDivision(divisionTopline);
    };

    const handleKeyDown = (
      event: KeyboardEvent,
    ) => {
      if (
        event.key !== "Enter" &&
        event.key !== " "
      ) {
        return;
      }

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const divisionTopline =
        target.closest<HTMLElement>(
          ".standings-division-toggle",
        );

      if (
        !divisionTopline ||
        !page.contains(divisionTopline)
      ) {
        return;
      }

      event.preventDefault();
      toggleDivision(divisionTopline);
    };

    const observer = new MutationObserver(
      scheduleSynchronization,
    );

    observer.observe(page, {
      attributes: true,
      attributeFilter: ["class"],
      childList: true,
      subtree: true,
    });

    page.addEventListener(
      "click",
      handleClick,
    );

    page.addEventListener(
      "keydown",
      handleKeyDown,
    );

    synchronizeDivisionCards();

    return () => {
      observer.disconnect();

      page.removeEventListener(
        "click",
        handleClick,
      );

      page.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(
          animationFrameId,
        );
      }
    };
  }, [activePlayerId]);

  return null;
}

function Standings() {
  return (
    <div className="standings-page-layout">
      <StandingsBoard />
      <StandingsDivisionOrganizer />
      <BestDivisionRaceAfterDivisions />
      <WeeklyAwardsAfterPickerClicker />
    </div>
  );
}

export default Standings;
