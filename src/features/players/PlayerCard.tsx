import type { Player } from "../../types/player";

type PlayerCardProps = {
  player: Player;
  onDelete: (playerId: string) => void;
};

function PlayerCard({ player, onDelete }: PlayerCardProps) {
  return (
    <div className="player-card">
      <div>
        <h3>{player.name}</h3>
        <p>{player.nflTeam}</p>
      </div>

      <div className="player-actions">
        <span className="status active">Active</span>
        <button onClick={() => onDelete(player.id)}>Delete</button>
      </div>
    </div>
  );
}

export default PlayerCard;