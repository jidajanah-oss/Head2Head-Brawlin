import SeasonAwardsBoard from "../features/awards/SeasonAwardsBoard";
import CommissionerSeasonCloseout from "../features/closeout/CommissionerSeasonCloseout";
import CommissionerSeasonOperations from "../features/commissioner/CommissionerSeasonOperations";
import FutureSeasonDraftPanel from "../features/commissioner/FutureSeasonDraftPanel";
import LinkedPlayerAccountResetPanel from "../features/auth/LinkedPlayerAccountResetPanel";
import CommissionerPayoutLedger from "../features/payouts/CommissionerPayoutLedger";
import CommissionerPlayoffResults from "../features/playoffs/CommissionerPlayoffResults";
import CommissionerDataTransfer from "../features/transfer/CommissionerDataTransfer";

export default function Commissioner() {
  return (
    <>
      <CommissionerSeasonOperations />
      <LinkedPlayerAccountResetPanel />
      <FutureSeasonDraftPanel />
      <CommissionerDataTransfer />
      <SeasonAwardsBoard showCoinFlipControls />
      <CommissionerPlayoffResults />
      <CommissionerPayoutLedger />
      <CommissionerSeasonCloseout />
    </>
  );
}
