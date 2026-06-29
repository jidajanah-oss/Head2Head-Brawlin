import type { WeekGame } from "../../engine";
import {
  getStatusEmoji,
  getStatusLabel,
} from "../../features/games/gameCenterUtils";

interface StatusBadgeProps {
  game: WeekGame;
}

function StatusBadge({ game }: StatusBadgeProps) {
  const label = getStatusLabel(game);
  const emoji = getStatusEmoji(game);

  return (
    <span className={`status-badge status-badge-${label.toLowerCase()}`}>
      {emoji} {label}
    </span>
  );
}

export default StatusBadge;