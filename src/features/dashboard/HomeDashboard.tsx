import {
  useEffect,
  useMemo,
  useState,
} from "react";

import OpponentPickRevealPanel from "../picks/OpponentPickRevealPanel";
import { HeadToHeadMatchupsBoard } from "../standings/StandingsBoard";
import HistoricalWeekPanel from "./HistoricalWeekPanel";
import "../../styles/opponentPickReveal.css";
import {
  SteelButton,
  SteelCard,
} from "../../components/steel";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import ObscureStatAwardCard from "../awards/ObscureStatAwardCard";
import { getStatusLabel } from "../games/gameCenterUtils";

const LEAGUE_LOGO_PATH =
  `${import.meta.env.BASE_URL}logos/league/head2head-brawlin.png`;

function HomeDashboard() {
  const {
    league,
    scoringHistory,
  } = useLeague();

  const { snapshot } = useNFL();

  const [
    viewedWeek,
    setViewedWeek,
  ] =
    useState(
      league.currentWeek,
    );

  useEffect(() => {
    setViewedWeek(
      league.currentWeek,
    );
  }, [league.currentWeek]);

  const season = Number.parseInt(
    String(
      league.settings.season,
    ),
    10,
  );

  const pastWeeks = useMemo(
    () =>
      Array.from(
        new Set(
          Object.values(
            scoringHistory,
          )
            .filter(
              (record) =>
                record.season ===
                  season &&
                record.week <
                  league.currentWeek,
            )
            .map(
              (record) =>
                record.week,
            ),
        ),
      ).sort(
        (left, right) =>
          right - left,
      ),
    [
      league.currentWeek,
      scoringHistory,
      season,
    ],
  );

  const viewingCurrentWeek =
    viewedWeek ===
    league.currentWeek;

  const liveGames = (
    snapshot?.weekGames ?? []
  ).filter(
    (game) =>
      getStatusLabel(
        game,
      )
        .toLowerCase()
        .includes("live"),
  );

  return (
    <main className="dashboard dashboard-v2">
      <SteelCard
        className="dashboard-brand-hero"
        as="section"
      >
        <div className="dashboard-brand-hero__logo-shell">
          <img
            className="dashboard-brand-hero__logo"
            src={LEAGUE_LOGO_PATH}
            alt="Head2Head Brawlin' Pick Em 2026 league logo"
          />
        </div>

        <div className="dashboard-brand-hero__content">
          <p className="steel-ui-eyebrow">
            2026 Pick&apos;em League
          </p>

          <h1>
            League Command Center
          </h1>

          <p>
            Make your picks, follow the
            weekly schedule, and track
            the championship race.
          </p>

          <div className="dashboard-brand-hero__actions">
            <SteelButton
              href="/picks"
              size="lg"
            >
              Make Picks
            </SteelButton>

            <SteelButton
              href="/games"
              size="lg"
              variant="secondary"
            >
              Game Center
            </SteelButton>
          </div>
        </div>

        <div className="dashboard-week-card dashboard-brand-hero__week">
          <span>
            {viewingCurrentWeek
              ? "Current Week"
              : "Viewing History"}
          </span>

          <strong>
            Week {viewedWeek}
          </strong>

          <small>
            {viewingCurrentWeek
              ? liveGames.length >
                0
                ? "Games live now"
                : "Board active"
              : "Read only"}
          </small>
        </div>
      </SteelCard>

      {pastWeeks.length > 0 ? (
        <SteelCard
          variant="gold"
          as="section"
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div>
              <p className="steel-ui-eyebrow">
                Week History
              </p>

              <strong
                style={{
                  display:
                    "block",
                  fontSize:
                    "1.15rem",
                }}
              >
                View current or
                completed weeks
              </strong>

              <small>
                Past weeks are
                read-only and cannot
                change saved picks.
              </small>
            </div>

            <label
              style={{
                display: "grid",
                gap: "0.35rem",
                minWidth:
                  "190px",
              }}
            >
              <span
                style={{
                  fontSize:
                    "0.75rem",
                  fontWeight: 800,
                  letterSpacing:
                    "0.08em",
                  textTransform:
                    "uppercase",
                }}
              >
                Display Week
              </span>

              <select
                value={viewedWeek}
                onChange={(
                  event,
                ) =>
                  setViewedWeek(
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
                style={{
                  minHeight:
                    "48px",
                  borderRadius:
                    "12px",
                  border:
                    "1px solid rgba(255, 196, 0, 0.45)",
                  background:
                    "#161616",
                  color:
                    "#ffffff",
                  padding:
                    "0 0.9rem",
                  fontWeight:
                    800,
                  fontSize:
                    "1rem",
                }}
              >
                <option
                  value={
                    league.currentWeek
                  }
                >
                  Week{" "}
                  {
                    league.currentWeek
                  }{" "}
                  — Current
                </option>

                {pastWeeks.map(
                  (week) => (
                    <option
                      key={
                        week
                      }
                      value={
                        week
                      }
                    >
                      Week{" "}
                      {week}{" "}
                      — Final
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        </SteelCard>
      ) : null}

      {viewingCurrentWeek ? (
        <>
          <OpponentPickRevealPanel
            comparison
          />

          <HeadToHeadMatchupsBoard />

          <ObscureStatAwardCard className="dashboard-obscure-stat-award" />
        </>
      ) : (
        <HistoricalWeekPanel
          week={viewedWeek}
        />
      )}
    </main>
  );
}

export default HomeDashboard;
