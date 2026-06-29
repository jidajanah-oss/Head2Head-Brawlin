import type { WeekGame } from "../../engine";
import { PickLockEngine } from "../../engine";
import CountdownTimer from "./CountdownTimer";
import StatusBadge from "./StatusBadge";
import TeamLogo from "./TeamLogo";
import "./GameCard.css";

interface GameCardProps {
  game: WeekGame;
  selectedPick?: string;
  activePlayerId?: string;
  onPick: (gameId: string, team: string) => void;
}

function GameCard({
  game,
  selectedPick,
  activePlayerId,
  onPick,
}: GameCardProps) {
  const locked = PickLockEngine.isPickLocked(game);

  return (
    <article className="game-card-pro">
      <div className="game-card-top">
        <div>
          <p className="game-label">NFL Week {game.week}</p>
          <h3>
            {game.awayTeam} <span>@</span> {game.homeTeam}
          </h3>
        </div>

        <StatusBadge game={game} />
      </div>

      <div className="team-matchup">
        <div className="team-side">
          <TeamLogo team={game.awayTeam} />
          <strong>{game.awayTeam}</strong>
        </div>

        <div className="versus">@</div>

        <div className="team-side">
          <TeamLogo team={game.homeTeam} />
          <strong>{game.homeTeam}</strong>
        </div>
      </div>

      <div className="game-meta">
        <span>🕒 {new Date(game.kickoff).toLocaleString()}</span>
        <CountdownTimer kickoff={game.kickoff} locked={locked} />
      </div>

      <div className="pick-row">
        <button
          disabled={locked}
          className={selectedPick === game.awayTeam ? "selected" : ""}
          onClick={() => onPick(game.id, game.awayTeam)}
        >
          Pick {game.awayTeam}
        </button>

        <button
          disabled={locked}
          className={selectedPick === game.homeTeam ? "selected" : ""}
          onClick={() => onPick(game.id, game.homeTeam)}
        >
          Pick {game.homeTeam}
        </button>
      </div>

      {activePlayerId && selectedPick && (
        <p className="current-pick">
          {activePlayerId}'s pick: <strong>{selectedPick}</strong>
        </p>
      )}
    </article>
  );
}

export default GameCard;