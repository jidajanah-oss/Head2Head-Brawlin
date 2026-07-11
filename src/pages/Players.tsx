import CloudAccountPanel from "../features/auth/CloudAccountPanel";
import PlayerManager from "../features/players/PlayerManager";

import "../styles/auth.css";
import "../styles/players.css";

export default function Players() {
  return (
    <>
      <CloudAccountPanel />
      <PlayerManager />
    </>
  );
}
