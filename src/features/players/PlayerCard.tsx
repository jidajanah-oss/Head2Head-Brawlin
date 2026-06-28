import type { Player } from "../../types/player";

type PlayerCardProps = {
  player: Player;
  onDelete: (playerId: string) => void;
};

function PlayerCard({ player, onDelete }: PlayerCardProps) {
  const getRoleBadge = () => {
    switch (player.role) {
      case "commissioner":
        return (
          <span className="role-badge commissioner">
            👑 Commissioner
          </span>
        );

      case "backup_commissioner":
        return (
          <span className="role-badge backup">
            🛡️ Backup Commish
          </span>
        );

      default:
        return (
          <span className="role-badge player">
            👤 Player
          </span>
        );
    }
  };

  return (
    <div className="player-card">

      <div>
        <h3>{player.name}</h3>
        <p>{player.nflTeam}</p>
      </div>

      <div className="player-actions">
        {getRoleBadge()}

        <button onClick={() => onDelete(player.id)}>
          Delete
        </button>
      </div>

    </div>
  );
}

export default PlayerCard;