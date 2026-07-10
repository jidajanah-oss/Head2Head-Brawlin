import ObscureStatAwardCard from "../features/awards/ObscureStatAwardCard";
import PublicPlayoffResults from "../features/playoffs/PublicPlayoffResults";
import StandingsBoard from "../features/standings/StandingsBoard";

import "../styles/standings.css";

function Standings() {
  return (
    <>
      <ObscureStatAwardCard />
      <PublicPlayoffResults />
      <StandingsBoard />
    </>
  );
}

export default Standings;
