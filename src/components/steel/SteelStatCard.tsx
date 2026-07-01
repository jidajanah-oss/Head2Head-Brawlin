import type { ReactNode } from "react";
import SteelCard from "./SteelCard";

type SteelStatCardProps = {
  label: string;
  value: ReactNode;
  helper?: string;
  icon?: ReactNode;
  className?: string;
};

function SteelStatCard({
  label,
  value,
  helper,
  icon,
  className = "",
}: SteelStatCardProps) {
  return (
    <SteelCard className={`steel-ui-stat-card ${className}`.trim()}>
      <div className="steel-ui-stat-top">
        <span>{label}</span>

        {icon ? (
          <div className="steel-ui-stat-icon">
            {icon}
          </div>
        ) : null}
      </div>

      <strong>{value}</strong>

      {helper ? <small>{helper}</small> : null}
    </SteelCard>
  );
}

export default SteelStatCard;