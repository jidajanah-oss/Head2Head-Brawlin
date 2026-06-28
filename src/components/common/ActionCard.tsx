type ActionCardProps = {
  icon: string;
  title: string;
  subtitle: string;
};

function ActionCard({ icon, title, subtitle }: ActionCardProps) {
  return (
    <div className="action-card">
      <div className="action-icon">{icon}</div>
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

export default ActionCard;