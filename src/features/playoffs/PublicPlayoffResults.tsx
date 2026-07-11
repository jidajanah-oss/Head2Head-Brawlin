import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  getPlayoffMatchupsByRound,
  getPlayoffSeasonId,
  type PlayoffMatchupRecord,
  type PlayoffMatchupStatus,
  type PlayoffParticipantSnapshot,
  type PlayoffRound,
  type PlayoffSeasonState,
} from "../../engine";

import "../../styles/public-playoff-results.css";

const ROUND_ORDER: PlayoffRound[] = [
  "wildcard",
  "divisional",
  "conference-championship",
  "super-bowl",
];

const ROUND_LABELS: Record<PlayoffRound, string> = {
  wildcard: "Wild Card Round",
  divisional: "Divisional Round",
  "conference-championship":
    "Conference Championships",
  "super-bowl": "Super Bowl",
};

function formatParticipantRecord(
  participant: PlayoffParticipantSnapshot,
): string {
  const tieText =
    participant.regularSeasonTies > 0
      ? `-${participant.regularSeasonTies}`
      : "";

  return `${participant.regularSeasonWins}-${participant.regularSeasonLosses}${tieText}`;
}

function getStatusLabel(
  status: PlayoffMatchupStatus,
): string {
  if (status === "final") {
    return "Final";
  }

  if (status === "needs-resolution") {
    return "Tie Resolution Needed";
  }

  if (status === "ready") {
    return "Ready";
  }

  return "Waiting";
}

function getStatusClass(
  status: PlayoffMatchupStatus,
): string {
  return `public-playoff-status public-playoff-status--${status}`;
}

function getParticipantById(
  playoffSeason: PlayoffSeasonState,
  playerId: string | null,
): PlayoffParticipantSnapshot | null {
  if (!playerId) {
    return null;
  }

  return (
    [
      ...playoffSeason.seeds.AFC,
      ...playoffSeason.seeds.NFC,
    ].find(
      (participant) =>
        participant.playerId === playerId,
    ) ?? null
  );
}

function ParticipantRow({
  participant,
  score,
  winnerId,
}: {
  participant: PlayoffParticipantSnapshot | null;
  score: number | null;
  winnerId: string | null;
}) {
  if (!participant) {
    return (
      <div className="public-playoff-participant public-playoff-participant--pending">
        <span className="public-playoff-pending-icon">
          ?
        </span>

        <div className="public-playoff-participant-copy">
          <strong>Pending advancement</strong>
          <span>
            Waiting for the previous round to finish
          </span>
        </div>

        <span className="public-playoff-score">
          —
        </span>
      </div>
    );
  }

  const isWinner =
    winnerId === participant.playerId;

  return (
    <div
      className={[
        "public-playoff-participant",
        isWinner
          ? "public-playoff-participant--winner"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="public-playoff-seed-logo">
        <span className="public-playoff-seed">
          #{participant.seed}
        </span>

        <FranchiseLogo
          nflTeam={participant.nflTeam}
          displayName={participant.playerName}
          size="sm"
          variant="tile"
        />
      </div>

      <div className="public-playoff-participant-copy">
        <strong>
          {participant.playerName}
        </strong>

        <span>
          {participant.nflTeam} •{" "}
          {participant.conference} •{" "}
          {formatParticipantRecord(
            participant,
          )}{" "}
          •{" "}
          {
            participant.regularSeasonLeaguePoints
          }{" "}
          pts
        </span>
      </div>

      <span className="public-playoff-score">
        {score ?? "—"}
      </span>
    </div>
  );
}

function MatchupCard({
  matchup,
}: {
  matchup: PlayoffMatchupRecord;
}) {
  const hasFinalWinner =
    matchup.status === "final" &&
    Boolean(matchup.winnerId);

  return (
    <article className="public-playoff-matchup">
      <header className="public-playoff-matchup-header">
        <div>
          <span className="public-playoff-conference">
            {matchup.conference}
          </span>

          <h4>{matchup.title}</h4>

          <p>{matchup.matchupLabel}</p>
        </div>

        <span
          className={getStatusClass(
            matchup.status,
          )}
        >
          {getStatusLabel(matchup.status)}
        </span>
      </header>

      <div className="public-playoff-matchup-body">
        <ParticipantRow
          participant={
            matchup.teamA.participant
          }
          score={matchup.teamA.score}
          winnerId={matchup.winnerId}
        />

        <div className="public-playoff-versus">
          VS
        </div>

        <ParticipantRow
          participant={
            matchup.teamB.participant
          }
          score={matchup.teamB.score}
          winnerId={matchup.winnerId}
        />
      </div>

      <footer className="public-playoff-matchup-footer">
        <span>{matchup.note}</span>

        {matchup.status ===
        "needs-resolution" ? (
          <strong>
            Commissioner must select the
            advancing player.
          </strong>
        ) : null}

        {hasFinalWinner &&
        matchup.resultSource ===
          "commissioner-tie-resolution" ? (
          <strong>
            Advanced by commissioner tie
            resolution.
          </strong>
        ) : null}
      </footer>
    </article>
  );
}

function ByeCard({
  participant,
}: {
  participant:
    | PlayoffParticipantSnapshot
    | undefined;
}) {
  if (!participant) {
    return null;
  }

  return (
    <article className="public-playoff-bye-card">
      <FranchiseLogo
        nflTeam={participant.nflTeam}
        displayName={participant.playerName}
        size="md"
        variant="tile"
      />

      <div>
        <span>
          {participant.conference} #1 Seed
        </span>

        <strong>
          {participant.playerName}
        </strong>

        <small>
          {participant.nflTeam} • First-round
          bye
        </small>
      </div>
    </article>
  );
}

function ChampionCard({
  label,
  participant,
  featured = false,
}: {
  label: string;
  participant:
    | PlayoffParticipantSnapshot
    | null;
  featured?: boolean;
}) {
  return (
    <article
      className={[
        "public-playoff-champion-card",
        featured
          ? "public-playoff-champion-card--featured"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {participant ? (
        <FranchiseLogo
          nflTeam={participant.nflTeam}
          displayName={participant.playerName}
          size={featured ? "xl" : "lg"}
          variant="tile"
        />
      ) : (
        <span className="public-playoff-champion-placeholder">
          ?
        </span>
      )}

      <span>{label}</span>

      <strong>
        {participant?.playerName ?? "Pending"}
      </strong>

      <small>
        {participant
          ? `${participant.nflTeam} • #${participant.seed} seed`
          : "Not decided"}
      </small>
    </article>
  );
}

function PublicPlayoffResults() {
  const {
    league,
    playoffResultsHistory,
  } = useLeague();

  const { season } = useNFL();

  const playoffSeason =
    playoffResultsHistory[
      getPlayoffSeasonId(season)
    ] ?? null;

  if (!playoffSeason) {
    return (
      <section className="public-playoff-results public-playoff-results--waiting">
        <div className="public-playoff-results-kicker">
          Official Postseason
        </div>

        <h2>Playoff Bracket</h2>

        <p>
          The official bracket will appear
          after the commissioner freezes the
          seven AFC and seven NFC seeds.
        </p>

        <span>
          Season {season} • Current regular-season
          week {league.currentWeek}
        </span>
      </section>
    );
  }

  const afcBye =
    playoffSeason.seeds.AFC.find(
      (participant) =>
        participant.seed === 1,
    );

  const nfcBye =
    playoffSeason.seeds.NFC.find(
      (participant) =>
        participant.seed === 1,
    );

  const afcChampion =
    getParticipantById(
      playoffSeason,
      playoffSeason.afcChampionId,
    );

  const nfcChampion =
    getParticipantById(
      playoffSeason,
      playoffSeason.nfcChampionId,
    );

  const champion =
    getParticipantById(
      playoffSeason,
      playoffSeason.championId,
    );

  return (
    <section className="public-playoff-results">
      <header className="public-playoff-results-header">
        <div>
          <div className="public-playoff-results-kicker">
            Official Postseason
          </div>

          <h2>
            {season} Playoff Results
          </h2>

          <p>
            Frozen seeds, live advancement,
            conference champions, and the
            Head2Head Brawlin&apos; league
            champion.
          </p>
        </div>

        <div className="public-playoff-results-meta">
          <span>
            {playoffSeason.status ===
            "complete"
              ? "Playoffs Complete"
              : "Playoffs Active"}
          </span>

          <small>
            Seeds frozen{" "}
            {new Date(
              playoffSeason.seeds.capturedAt,
            ).toLocaleString()}
          </small>
        </div>
      </header>

      <div className="public-playoff-champions">
        <ChampionCard
          label="AFC Champion"
          participant={afcChampion}
        />

        <ChampionCard
          label="League Champion"
          participant={champion}
          featured
        />

        <ChampionCard
          label="NFC Champion"
          participant={nfcChampion}
        />
      </div>

      <div className="public-playoff-byes">
        <ByeCard participant={afcBye} />
        <ByeCard participant={nfcBye} />
      </div>

      <div className="public-playoff-rounds">
        {ROUND_ORDER.map((round) => {
          const matchups =
            getPlayoffMatchupsByRound(
              playoffSeason,
              round,
            );

          const finalCount =
            matchups.filter(
              (matchup) =>
                matchup.status === "final",
            ).length;

          return (
            <section
              className="public-playoff-round"
              key={round}
            >
              <header className="public-playoff-round-header">
                <div>
                  <span>Postseason</span>
                  <h3>
                    {ROUND_LABELS[round]}
                  </h3>
                </div>

                <strong>
                  {finalCount}/{matchups.length}{" "}
                  Final
                </strong>
              </header>

              <div className="public-playoff-matchup-grid">
                {matchups.map(
                  (matchup) => (
                    <MatchupCard
                      key={matchup.id}
                      matchup={matchup}
                    />
                  ),
                )}
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}

export default PublicPlayoffResults;
