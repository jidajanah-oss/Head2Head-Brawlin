import CommissionerToolSection from "../features/commissioner/CommissionerToolSection";
import SeasonAwardsBoard from "../features/awards/SeasonAwardsBoard";
import CommissionerSeasonCloseout from "../features/closeout/CommissionerSeasonCloseout";
import CommissionerSeasonOperations from "../features/commissioner/CommissionerSeasonOperations";
import FutureSeasonDraftPanel from "../features/commissioner/FutureSeasonDraftPanel";
import ComputerAccessManagerPanel from "../features/auth/ComputerAccessManagerPanel";
import LinkedPlayerAccountResetPanel from "../features/auth/LinkedPlayerAccountResetPanel";
import CommissionerPayoutLedger from "../features/payouts/CommissionerPayoutLedger";
import CommissionerPlayoffResults from "../features/playoffs/CommissionerPlayoffResults";
import CommissionerDataTransfer from "../features/transfer/CommissionerDataTransfer";
import "../styles/compactCommissioner.css";

export default function Commissioner() {
  return (
    <div className="compact-commissioner">
      <CommissionerSeasonOperations />
      <CommissionerToolSection title="Computer access"><ComputerAccessManagerPanel /></CommissionerToolSection>
      <CommissionerToolSection title="Player account reset"><LinkedPlayerAccountResetPanel /></CommissionerToolSection>
      <FutureSeasonDraftPanel />
      <CommissionerToolSection title="Backup and restore"><CommissionerDataTransfer /></CommissionerToolSection>
      <CommissionerToolSection title="Season awards"><SeasonAwardsBoard showCoinFlipControls /></CommissionerToolSection>
      <CommissionerToolSection title="Playoff results"><CommissionerPlayoffResults /></CommissionerToolSection>
      <CommissionerToolSection title="Payout ledger"><CommissionerPayoutLedger /></CommissionerToolSection>
      <CommissionerSeasonCloseout />
    </div>
  );
}
