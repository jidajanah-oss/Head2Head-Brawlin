import {
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ChangeEvent } from "react";

import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import { useLeague } from "../../context/LeagueContext";
import { useNFL } from "../../context/NFLContext";
import {
  buildEffectiveHeadToHeadPicks,
  buildNFLPlayoffPicture,
  buildSeasonAwareNFLStyleDivisionStandings,
  getPlayoffMatchupsByRound,
  getPlayoffSeasonId,
  type PlayoffMatchupRecord,
  type PlayoffParticipantSnapshot,
  type PlayoffRound,
} from "../../engine";

import "../../styles/playoff-results.css";

type Feedback = {
  type: "success" | "error";
  text: string;
};

type MatchupEditorProps = {
  matchup: PlayoffMatchupRecord;
  onRecord: (
    matchupId: string,
    teamAScore: number,
    teamBScore: number,
    commissionerWinnerId: string | null,
    note: string,
  ) => void;
  onClear: (matchupId: string) => void;
};

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
) {
  const ties = participant.regularSeasonTies
    ? `-${participant.regularSeasonTies}`
    : "";

  return `${participant.regularSeasonWins}-${participant.regularSeasonLosses}${ties}`;
}

function ParticipantCard({
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
      <div className="playoff-result-participant playoff-result-participant--waiting">
        <div className="playoff-result-participant__placeholder">
          Pending previous-round winner
        </div>
      </div>
    );
  }

  const isWinner =
    winnerId === participant.playerId;

  return (
    <div
      className={`playoff-result-participant${
        isWinner
          ? " playoff-result-participant--winner"
          : ""
      }`}
    >
      <FranchiseLogo
        nflTeam={participant.nflTeam}
        displayName={participant.playerName}
        size="sm"
        variant="tile"
      />

      <div className="playoff-result-participant__identity">
        <strong>
          #{participant.seed} {participant.playerName}
        </strong>
        <span>
          {participant.nflTeam} • {participant.conference}
        </span>
        <small>
          {formatParticipantRecord(participant)} •{" "}
          {participant.regularSeasonLeaguePoints} pts
        </small>
      </div>

      <div className="playoff-result-participant__score">
        {score ?? "—"}
      </div>
    </div>
  );
}

function MatchupEditor({
  matchup,
  onRecord,
  onClear,
}: MatchupEditorProps) {
  const [teamAScore, setTeamAScore] =
    useState(
      matchup.teamA.score?.toString() ?? "",
    );
  const [teamBScore, setTeamBScore] =
    useState(
      matchup.teamB.score?.toString() ?? "",
    );
  const [commissionerWinnerId, setCommissionerWinnerId] =
    useState(matchup.winnerId ?? "");
  const [note, setNote] = useState(
    matchup.note,
  );
  const [feedback, setFeedback] =
    useState<Feedback | null>(null);

  useEffect(() => {
    setTeamAScore(
      matchup.teamA.score?.toString() ?? "",
    );
    setTeamBScore(
      matchup.teamB.score?.toString() ?? "",
    );
    setCommissionerWinnerId(
      matchup.winnerId ?? "",
    );
    setNote(matchup.note);
    setFeedback(null);
  }, [
    matchup.id,
    matchup.teamA.participant?.playerId,
    matchup.teamB.participant?.playerId,
    matchup.teamA.score,
    matchup.teamB.score,
    matchup.winnerId,
    matchup.note,
  ]);

  const participantA =
    matchup.teamA.participant;
  const participantB =
    matchup.teamB.participant;
  const participantsReady = Boolean(
    participantA && participantB,
  );

  const parsedTeamAScore = Number(teamAScore);
  const parsedTeamBScore = Number(teamBScore);
  const scoresAreValid =
    teamAScore.trim() !== "" &&
    teamBScore.trim() !== "" &&
    Number.isInteger(parsedTeamAScore) &&
    Number.isInteger(parsedTeamBScore) &&
    parsedTeamAScore >= 0 &&
    parsedTeamBScore >= 0;
  const isTie =
    scoresAreValid &&
    parsedTeamAScore === parsedTeamBScore;

  const handleScoreAChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setTeamAScore(event.target.value);
    setFeedback(null);
  };

  const handleScoreBChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setTeamBScore(event.target.value);
    setFeedback(null);
  };

  const handleWinnerChange = (
    event: ChangeEvent<HTMLSelectElement>,
  ) => {
    setCommissionerWinnerId(
      event.target.value,
    );
    setFeedback(null);
  };

  const handleNoteChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setNote(event.target.value);
  };

  const handleSave = () => {
    if (!participantsReady) {
      setFeedback({
        type: "error",
        text: "Both matchup participants must be known before a result can be recorded.",
      });
      return;
    }

    if (!scoresAreValid) {
      setFeedback({
        type: "error",
        text: "Enter non-negative whole-number scores for both players.",
      });
      return;
    }

    try {
      onRecord(
        matchup.id,
        parsedTeamAScore,
        parsedTeamBScore,
        isTie
          ? commissionerWinnerId || null
          : null,
        note.trim() || matchup.note,
      );

      setFeedback({
        type: "success",
        text:
          isTie && !commissionerWinnerId
            ? "Tie saved. Select the advancing player to finalize this matchup."
            : "Playoff result saved.",
      });
    } catch (error) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to save the playoff result.",
      });
    }
  };

  const handleClear = () => {
    const confirmed = window.confirm(
      "Clear this result? Any later-round result that depends on this winner may also be reset.",
    );

    if (!confirmed) {
      return;
    }

    onClear(matchup.id);
    setFeedback({
      type: "success",
      text: "Playoff result cleared.",
    });
  };

  const hasStoredResult =
    matchup.teamA.score !== null ||
    matchup.teamB.score !== null ||
    matchup.status === "final" ||
    matchup.status === "needs-resolution";

  return (
    <article className="playoff-result-card">
      <header className="playoff-result-card__header">
        <div>
          <span>{matchup.conference}</span>
          <h4>{matchup.title}</h4>
          <p>{matchup.matchupLabel}</p>
        </div>

        <strong
          className={`playoff-result-status playoff-result-status--${matchup.status}`}
        >
          {matchup.status.replace("-", " ")}
        </strong>
      </header>

      <div className="playoff-result-card__participants">
        <ParticipantCard
          participant={participantA}
          score={matchup.teamA.score}
          winnerId={matchup.winnerId}
        />

        <div className="playoff-result-card__versus">
          VS
        </div>

        <ParticipantCard
          participant={participantB}
          score={matchup.teamB.score}
          winnerId={matchup.winnerId}
        />
      </div>

      <div className="playoff-result-editor">
        <label>
          <span>
            {participantA?.playerName ?? "Player A"} score
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={teamAScore}
            disabled={!participantsReady}
            onChange={handleScoreAChange}
          />
        </label>

        <label>
          <span>
            {participantB?.playerName ?? "Player B"} score
          </span>
          <input
            type="number"
            min="0"
            step="1"
            value={teamBScore}
            disabled={!participantsReady}
            onChange={handleScoreBChange}
          />
        </label>

        {isTie && participantsReady ? (
          <label className="playoff-result-editor__tie">
            <span>Advancing player</span>
            <select
              value={commissionerWinnerId}
              onChange={handleWinnerChange}
            >
              <option value="">
                Leave unresolved
              </option>
              <option value={participantA?.playerId}>
                {participantA?.playerName}
              </option>
              <option value={participantB?.playerId}>
                {participantB?.playerName}
              </option>
            </select>
          </label>
        ) : null}

        <label className="playoff-result-editor__note">
          <span>Commissioner note</span>
          <input
            type="text"
            value={note}
            disabled={!participantsReady}
            onChange={handleNoteChange}
          />
        </label>
      </div>

      <footer className="playoff-result-card__footer">
        <div>
          {feedback ? (
            <p
              className={`playoff-result-feedback playoff-result-feedback--${feedback.type}`}
            >
              {feedback.text}
            </p>
          ) : (
            <p>{matchup.note}</p>
          )}
        </div>

        <div className="playoff-result-card__actions">
          {hasStoredResult ? (
            <button
              type="button"
              className="playoff-result-button playoff-result-button--danger"
              onClick={handleClear}
            >
              Clear Result
            </button>
          ) : null}

          <button
            type="button"
            className="playoff-result-button playoff-result-button--primary"
            disabled={!participantsReady}
            onClick={handleSave}
          >
            Save Result
          </button>
        </div>
      </footer>
    </article>
  );
}

function CommissionerPlayoffResults() {
  const {
    league,
    picks,
    gameResults,
    scoringHistory,
    pickerClickerHistory,
    playoffResultsHistory,
    initializePlayoffSeason,
    resetPlayoffSeason,
    recordPlayoffMatchupResult,
    clearPlayoffMatchupResult,
  } = useLeague();
  const { season, snapshot } = useNFL();

  const nflGames = useMemo(
    () => snapshot?.nflGames ?? [],
    [snapshot],
  );

  const allPicks = useMemo(
    () =>
      league.players.reduce<
        Record<
          string,
          Record<string, string>
        >
      >((playerPicks, player) => {
        playerPicks[player.id] =
          picks[player.id] || {};
        return playerPicks;
      }, {}),
    [league.players, picks],
  );

  const effectiveAllPicks = useMemo(
    () =>
      buildEffectiveHeadToHeadPicks({
        picks: allPicks,
        pickerClickerHistory,
        season,
        throughWeek: league.currentWeek,
      }),
    [
      allPicks,
      pickerClickerHistory,
      season,
      league.currentWeek,
    ],
  );

  const divisionStandings = useMemo(
    () =>
      buildSeasonAwareNFLStyleDivisionStandings({
        players: league.players,
        picks: effectiveAllPicks,
        gameResults,
        scoringHistory,
        nflGames,
        season,
        week: league.currentWeek,
      }),
    [
      league.players,
      effectiveAllPicks,
      gameResults,
      scoringHistory,
      nflGames,
      season,
      league.currentWeek,
    ],
  );

  const playoffPicture = useMemo(
    () =>
      buildNFLPlayoffPicture(
        divisionStandings,
      ),
    [divisionStandings],
  );

  const playoffSeasonId =
    getPlayoffSeasonId(season);
  const playoffSeason =
    playoffResultsHistory[
      playoffSeasonId
    ] ?? null;

  const afcSeedCount =
    playoffPicture.conferences.find(
      (conference) =>
        conference.conference === "AFC",
    )?.seeds.length ?? 0;
  const nfcSeedCount =
    playoffPicture.conferences.find(
      (conference) =>
        conference.conference === "NFC",
    )?.seeds.length ?? 0;
  const seedsReady =
    afcSeedCount >= 7 && nfcSeedCount >= 7;

  const participantById = useMemo(() => {
    if (!playoffSeason) {
      return new Map<
        string,
        PlayoffParticipantSnapshot
      >();
    }

    return new Map(
      [
        ...playoffSeason.seeds.AFC,
        ...playoffSeason.seeds.NFC,
      ].map((participant) => [
        participant.playerId,
        participant,
      ]),
    );
  }, [playoffSeason]);

  const handleInitialize = () => {
    if (!seedsReady) {
      return;
    }

    if (
      league.currentWeek < 18 &&
      !window.confirm(
        `The league is currently on Week ${league.currentWeek}. Initialize and freeze the playoff seeds early?`,
      )
    ) {
      return;
    }

    initializePlayoffSeason(
      season,
      playoffPicture,
    );
  };

  const handleReset = () => {
    const confirmed = window.confirm(
      "Reset the entire playoff bracket? All saved playoff scores and winners for this season will be removed.",
    );

    if (!confirmed) {
      return;
    }

    resetPlayoffSeason(
      season,
      playoffPicture,
    );
  };

  const handleRecord = (
    matchupId: string,
    teamAScore: number,
    teamBScore: number,
    commissionerWinnerId: string | null,
    note: string,
  ) => {
    recordPlayoffMatchupResult(season, {
      matchupId,
      teamAScore,
      teamBScore,
      commissionerWinnerId,
      note,
    });
  };

  const handleClear = (matchupId: string) => {
    clearPlayoffMatchupResult(
      season,
      matchupId,
    );
  };

  const champion = playoffSeason?.championId
    ? participantById.get(
        playoffSeason.championId,
      ) ?? null
    : null;
  const afcChampion =
    playoffSeason?.afcChampionId
      ? participantById.get(
          playoffSeason.afcChampionId,
        ) ?? null
      : null;
  const nfcChampion =
    playoffSeason?.nfcChampionId
      ? participantById.get(
          playoffSeason.nfcChampionId,
        ) ?? null
      : null;

  return (
    <section className="commissioner-playoff-results">
      <header className="commissioner-playoff-results__hero">
        <div>
          <span className="commissioner-playoff-results__eyebrow">
            Milestone 8
          </span>
          <h2>Commissioner Playoff Results</h2>
          <p>
            Freeze the seven AFC and seven NFC seeds, record each playoff score, and advance winners through NFL-style reseeding.
          </p>
        </div>

        <div className="commissioner-playoff-results__season">
          <span>Season</span>
          <strong>{season}</strong>
          <small>
            Regular-season Week {league.currentWeek}
          </small>
        </div>
      </header>

      {!playoffSeason ? (
        <div className="playoff-initialization-panel">
          <div className="playoff-seed-readiness">
            <div>
              <span>AFC Seeds</span>
              <strong>{afcSeedCount}/7</strong>
            </div>
            <div>
              <span>NFC Seeds</span>
              <strong>{nfcSeedCount}/7</strong>
            </div>
            <div>
              <span>Bracket Status</span>
              <strong>
                {seedsReady
                  ? "Ready"
                  : "Waiting"}
              </strong>
            </div>
          </div>

          <p>
            Initialization captures a permanent snapshot of the current playoff seeds. Later standings changes will not silently replace the postseason field.
          </p>

          <button
            type="button"
            className="playoff-result-button playoff-result-button--primary"
            disabled={!seedsReady}
            onClick={handleInitialize}
          >
            Initialize {season} Playoffs
          </button>

          {!seedsReady ? (
            <small>
              Seven seeded players are required in each conference before the bracket can be initialized.
            </small>
          ) : null}
        </div>
      ) : (
        <>
          <div className="playoff-champion-summary">
            <div>
              <span>AFC Champion</span>
              <strong>
                {afcChampion
                  ? afcChampion.playerName
                  : "Pending"}
              </strong>
              <small>
                {afcChampion?.nflTeam ?? "—"}
              </small>
            </div>

            <div className="playoff-champion-summary__league">
              <span>League Champion</span>
              <strong>
                {champion
                  ? champion.playerName
                  : "Pending"}
              </strong>
              <small>
                {champion?.nflTeam ??
                  "Super Bowl not final"}
              </small>
            </div>

            <div>
              <span>NFC Champion</span>
              <strong>
                {nfcChampion
                  ? nfcChampion.playerName
                  : "Pending"}
              </strong>
              <small>
                {nfcChampion?.nflTeam ?? "—"}
              </small>
            </div>
          </div>

          <div className="playoff-results-toolbar">
            <div>
              <strong>
                {playoffSeason.status === "complete"
                  ? "Playoffs Complete"
                  : "Playoffs Active"}
              </strong>
              <span>
                Seeds frozen{" "}
                {new Date(
                  playoffSeason.seeds.capturedAt,
                ).toLocaleString()}
              </span>
            </div>

            <button
              type="button"
              className="playoff-result-button playoff-result-button--danger"
              onClick={handleReset}
            >
              Reset Playoffs
            </button>
          </div>

          {ROUND_ORDER.map((round) => {
            const matchups =
              getPlayoffMatchupsByRound(
                playoffSeason,
                round,
              );

            return (
              <div
                key={round}
                className="playoff-results-round"
              >
                <div className="playoff-results-round__header">
                  <div>
                    <span>Postseason</span>
                    <h3>{ROUND_LABELS[round]}</h3>
                  </div>
                  <strong>
                    {
                      matchups.filter(
                        (matchup) =>
                          matchup.status === "final",
                      ).length
                    }
                    /{matchups.length} Final
                  </strong>
                </div>

                <div className="playoff-results-grid">
                  {matchups.map((matchup) => (
                    <MatchupEditor
                      key={matchup.id}
                      matchup={matchup}
                      onRecord={handleRecord}
                      onClear={handleClear}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

export default CommissionerPlayoffResults;
