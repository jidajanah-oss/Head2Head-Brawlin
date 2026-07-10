import ObscureStatAwardCard from "../features/awards/ObscureStatAwardCard";
import StandingsBoard from "../features/standings/StandingsBoard";

import "../styles/standings.css";

function Standings() {
  return (
    <>
      <div
        className="standings-obscure-stat-award-slot"
        style={{
          marginBottom: "18px",
        }}
      >
        <ObscureStatAwardCard
          className="standings-obscure-stat-award"
          showLeaderboard
        />
      </div>

      <StandingsBoard />
    </>
  );
}

export default Standings;