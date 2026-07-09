import {
  getFranchiseLogoAlt,
  getFranchiseLogoFallbackText,
  getFranchiseLogoPath,
} from "../../engine";
import "../../styles/franchiseLogos.css";

type FranchiseLogoSize = "xs" | "sm" | "md" | "lg" | "xl";
type FranchiseLogoVariant = "badge" | "tile" | "ghost";

type FranchiseLogoProps = {
  nflTeam?: string | null;
  customLogo?: string | null;
  displayName?: string | null;
  size?: FranchiseLogoSize;
  variant?: FranchiseLogoVariant;
  className?: string;
};

function FranchiseLogo({
  nflTeam,
  customLogo,
  displayName,
  size = "md",
  variant = "badge",
  className = "",
}: FranchiseLogoProps) {
  const logoPath = getFranchiseLogoPath(nflTeam, customLogo);
  const fallbackText = getFranchiseLogoFallbackText(nflTeam);
  const alt = getFranchiseLogoAlt(nflTeam, displayName);

  const handleLogoError = (event: React.SyntheticEvent<HTMLImageElement>) => {
    event.currentTarget.style.display = "none";
    event.currentTarget.parentElement?.classList.add("franchise-logo--missing");
  };

  const classes = [
    "franchise-logo",
    `franchise-logo--${size}`,
    `franchise-logo--${variant}`,
    !logoPath ? "franchise-logo--missing" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} aria-label={alt} title={alt}>
      {logoPath ? (
        <img src={logoPath} alt={alt} loading="lazy" onError={handleLogoError} />
      ) : null}
      <span className="franchise-logo__fallback">{fallbackText}</span>
    </span>
  );
}

export default FranchiseLogo;