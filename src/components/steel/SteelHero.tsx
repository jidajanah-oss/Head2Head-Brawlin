import type { ReactNode } from "react";
import SteelButton from "./SteelButton";

type SteelHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  rightContent?: ReactNode;
  className?: string;
};

function SteelHero({
  eyebrow,
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  rightContent,
  className = "",
}: SteelHeroProps) {
  return (
    <section className={`steel-ui-hero ${className}`.trim()}>
      <div className="steel-ui-hero-left">
        {eyebrow ? <p className="steel-ui-eyebrow">{eyebrow}</p> : null}

        <h1>{title}</h1>

        {subtitle ? <p className="steel-ui-hero-subtitle">{subtitle}</p> : null}

        {(primaryLabel || secondaryLabel) && (
          <div className="steel-ui-hero-actions">
            {primaryLabel && primaryHref ? (
              <SteelButton href={primaryHref} variant="primary" size="lg">
                {primaryLabel}
              </SteelButton>
            ) : null}

            {secondaryLabel && secondaryHref ? (
              <SteelButton href={secondaryHref} variant="secondary" size="lg">
                {secondaryLabel}
              </SteelButton>
            ) : null}
          </div>
        )}
      </div>

      {rightContent ? <div className="steel-ui-hero-right">{rightContent}</div> : null}
    </section>
  );
}

export default SteelHero;