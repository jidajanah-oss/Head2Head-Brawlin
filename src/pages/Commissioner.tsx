import CommissionerPayoutLedger from "../features/payouts/CommissionerPayoutLedger";
import CommissionerPlayoffResults from "../features/playoffs/CommissionerPlayoffResults";
import SetupWizard from "../features/setup/SetupWizard";

import "../styles/setup.css";

export default function Commissioner() {
  return (
    <>
      <SetupWizard />
      <CommissionerPlayoffResults />
      <CommissionerPayoutLedger />
    </>
  );
}
