import CloudAccountPanel from "../features/auth/CloudAccountPanel";
import PlayerAccountReadinessPanel from "../features/auth/PlayerAccountReadinessPanel";
import MyFranchiseProfile from "../features/players/MyFranchiseProfile";
import PlayerManager from "../features/players/PlayerManager";
import { useAuth } from "../context/AuthContext";

import "../styles/auth.css";
import "../styles/cloudRoster.css";
import "../styles/myFranchiseProfile.css";
import "../styles/players.css";

export default function Players() {
  const { access } = useAuth();

  return (
    <>
      <MyFranchiseProfile />
      <CloudAccountPanel />

      {access.canManageAccounts ? (
        <PlayerAccountReadinessPanel />
      ) : null}

      {access.canManageLeague ? (
        <PlayerManager />
      ) : null}
    </>
  );
}