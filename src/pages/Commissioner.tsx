import CommissionerPayoutLedger from "../features/payouts/CommissionerPayoutLedger";
import SetupWizard from "../features/setup/SetupWizard";
import "../styles/setup.css";

export default function Commissioner() {
  return (
    <>
      <SetupWizard />
      <CommissionerPayoutLedger />
    </>
  );
}
