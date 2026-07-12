import SeasonAwardsBoard from "../features/awards/SeasonAwardsBoard";
import CommissionerSeasonCloseout from "../features/closeout/CommissionerSeasonCloseout";
import CommissionerSeasonOperations from "../features/commissioner/CommissionerSeasonOperations";
import CommissionerPayoutLedger from "../features/payouts/CommissionerPayoutLedger";
import CommissionerPlayoffResults from "../features/playoffs/CommissionerPlayoffResults";
import CommissionerDataTransfer from "../features/transfer/CommissionerDataTransfer";

export default function Commissioner() {
  return (
    <>
      <CommissionerSeasonOperations />
      <CommissionerDataTransfer />
      <SeasonAwardsBoard showCoinFlipControls />
      <CommissionerPlayoffResults />
      <CommissionerPayoutLedger />
      <CommissionerSeasonCloseout />
    </>
  );
}