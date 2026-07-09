import FranchiseLogo from "../../components/franchise/FranchiseLogo";
import { getNFLTeamDisplayName, getNFLTeamInfo } from "../../engine";
import type { Player } from "../../types/player";

type PlayerCardProps = {
  player: Player;
  onDelete: (playerId: string) => void;
};

function PlayerCard({ player, onDelete }: PlayerCardProps) {
  const teamInfo = getNFLTeamInfo(player.nflTeam);

  const getRoleBadge = () => {
    switch (player.role) {
      case "commissioner":
        return <span className="role-badge commissioner">Commissioner</span>;

      case "backup_commissioner":
        return <span className="role-badge backup">Backup Commish</span>;

      default:
        return <span className="role-badge player">Player</span>;
    }
  };

  return (
    <div className="player-card">
      <div className="player-card-logo-shell">
        <FranchiseLogo
          nflTeam={player.nflTeam}
          customLogo={player.customLogo}
          displayName={getNFLTeamDisplayName(player.nflTeam)}
          size="md"
          variant="tile"
        />

        <div>
          <h3>{player.name}</h3>
          <p>
            {player.nflTeam} • {getNFLTeamDisplayName(player.nflTeam)}
          </p>
          <small>
            {teamInfo ? `${teamInfo.conference} • ${teamInfo.division}` : "NFL franchise"}
          </small>
        </div>
      </div>

      <div className="player-actions">
        {getRoleBadge()}

        <button onClick={() => onDelete(player.id)} type="button">
          Delete
        </button>
      </div>
    </div>
  );
}

export default PlayerCard;