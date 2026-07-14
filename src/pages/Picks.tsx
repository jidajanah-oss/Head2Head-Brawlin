import PickSheet from "../features/picks/PickSheet";
import OpponentPickRevealPanel from "../features/picks/OpponentPickRevealPanel";
import WeeklyPickSubmissionPanel from "../features/picks/WeeklyPickSubmissionPanel";
import "../styles/picks.css";
import "../styles/weeklyPickSubmission.css";
import "../styles/opponentPickReveal.css";

export default function Picks() {
  return (
    <>
      <WeeklyPickSubmissionPanel />
      <PickSheet />
      <OpponentPickRevealPanel />
    </>
  );
}
