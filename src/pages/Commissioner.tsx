import SeasonAwardsBoard from "../features/awards/SeasonAwardsBoard";
import CommissionerSeasonCloseout from "../features/closeout/CommissionerSeasonCloseout";
import CommissionerPayoutLedger from "../features/payouts/CommissionerPayoutLedger";
import CommissionerPlayoffResults from "../features/playoffs/CommissionerPlayoffResults";
import SetupWizard from "../features/setup/SetupWizard";
import CommissionerDataTransfer from "../features/transfer/CommissionerDataTransfer";

import "../styles/setup.css";

export default function Commissioner() {
  return (
    <>
      <SetupWizard />
      <CommissionerDataTransfer />
      <SeasonAwardsBoard
        showCoinFlipControls
      />
      <CommissionerPlayoffResults />
      <CommissionerPayoutLedger />
      <CommissionerSeasonCloseout />
    </>
  );
}
