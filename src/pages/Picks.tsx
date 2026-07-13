import PickSheet from "../features/picks/PickSheet";
import WeeklyPickSubmissionPanel from "../features/picks/WeeklyPickSubmissionPanel";

import "../styles/picks.css";
import "../styles/weeklyPickSubmission.css";

export default function Picks() {
  return (
    <>
      <WeeklyPickSubmissionPanel />
      <PickSheet />
    </>
  );
}
