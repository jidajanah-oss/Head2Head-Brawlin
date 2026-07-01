import type { ReactNode } from "react";

type SteelSectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

function SteelSectionHeader({
  eyebrow,
  title,
  description,
  action,
  className = "",
}: SteelSectionHeaderProps) {
  return (
    <div className={`steel-ui-section-header ${className}`.trim()}>
      <div>
        {eyebrow ? <p className="steel-ui-eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      {action ? <div className="steel-ui-section-action">{action}</div> : null}
    </div>
  );
}

export default SteelSectionHeader;