import CloudAccountPanel from "../features/auth/CloudAccountPanel";
import PlayerAccountReadinessPanel from "../features/auth/PlayerAccountReadinessPanel";
import PlayerManager from "../features/players/PlayerManager";

import "../styles/auth.css";
import "../styles/cloudRoster.css";
import "../styles/players.css";

export default function Players() {
  return (
    <>
      <CloudAccountPanel />
      <PlayerAccountReadinessPanel />
      <PlayerManager />
    </>
  );
}
