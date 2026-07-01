import { Link } from "react-router-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type SteelButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type SteelButtonSize = "sm" | "md" | "lg";

type SteelButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  className?: string;
  href?: string;
  size?: SteelButtonSize;
  variant?: SteelButtonVariant;
};

function SteelButton({
  children,
  className = "",
  href,
  size = "md",
  variant = "primary",
  ...props
}: SteelButtonProps) {
  const classes = `steel-ui-button steel-ui-button--${variant} steel-ui-button--${size} ${className}`.trim();

  if (href) {
    return (
      <Link to={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button className={classes} type="button" {...props}>
      {children}
    </button>
  );
}

export default SteelButton;