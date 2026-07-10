import ObscureStatAwardCard from "../features/awards/ObscureStatAwardCard";
import SeasonAwardsBoard from "../features/awards/SeasonAwardsBoard";
import PublicPlayoffResults from "../features/playoffs/PublicPlayoffResults";
import StandingsBoard from "../features/standings/StandingsBoard";

import "../styles/standings.css";

function Standings() {
  return (
    <>
      <ObscureStatAwardCard />
      <SeasonAwardsBoard />
      <PublicPlayoffResults />
      <StandingsBoard />
    </>
  );
}

export default Standings;
