type CommissionerCardProps = {
  icon: string;
  title: string;
  subtitle: string;
};

function CommissionerCard({ icon, title, subtitle }: CommissionerCardProps) {
  return (
    <div className="commissioner-card">
      <div className="commissioner-card-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

export default CommissionerCard;