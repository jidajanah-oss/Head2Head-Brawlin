import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getDefaultFranchiseLogoPath,
  getFranchiseLogoAlt,
  getFranchiseLogoFallbackText,
  getFranchiseLogoPath,
} from "../../engine";

import "../../styles/franchiseLogos.css";

type FranchiseLogoSize =
  | "xs"
  | "sm"
  | "md"
  | "lg"
  | "xl";

type FranchiseLogoVariant =
  | "badge"
  | "tile"
  | "ghost";

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
  const preferredLogoPath =
    getFranchiseLogoPath(
      nflTeam,
      customLogo,
    );

  const defaultLogoPath =
    getDefaultFranchiseLogoPath(
      nflTeam,
    );

  const logoPaths = useMemo(
    () =>
      Array.from(
        new Set(
          [
            preferredLogoPath,
            defaultLogoPath,
          ].filter(Boolean),
        ),
      ),
    [
      preferredLogoPath,
      defaultLogoPath,
    ],
  );

  const [
    logoPathIndex,
    setLogoPathIndex,
  ] = useState(0);

  useEffect(() => {
    setLogoPathIndex(0);
  }, [
    preferredLogoPath,
    defaultLogoPath,
  ]);

  const activeLogoPath =
    logoPaths[logoPathIndex] ?? "";

  const fallbackText =
    getFranchiseLogoFallbackText(
      nflTeam,
    );

  const alt = getFranchiseLogoAlt(
    nflTeam,
    displayName,
  );

  const handleLogoError = () => {
    setLogoPathIndex(
      (currentIndex) =>
        currentIndex + 1,
    );
  };

  const classes = [
    "franchise-logo",
    `franchise-logo--${size}`,
    `franchise-logo--${variant}`,
    !activeLogoPath
      ? "franchise-logo--missing"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      aria-label={alt}
      title={alt}
    >
      {activeLogoPath ? (
        <img
          key={activeLogoPath}
          src={activeLogoPath}
          alt={alt}
          loading="lazy"
          onError={handleLogoError}
        />
      ) : null}

      <span className="franchise-logo__fallback">
        {fallbackText}
      </span>
    </span>
  );
}

export default FranchiseLogo;
