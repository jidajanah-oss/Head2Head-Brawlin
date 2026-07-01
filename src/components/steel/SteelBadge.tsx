import type { HTMLAttributes, ReactNode } from "react";

type SteelBadgeVariant =
  | "gold"
  | "success"
  | "danger"
  | "info"
  | "neutral";

type SteelBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  variant?: SteelBadgeVariant;
  className?: string;
};

function SteelBadge({
  children,
  variant = "neutral",
  className = "",
  ...props
}: SteelBadgeProps) {
  return (
    <span
      className={`steel-ui-badge steel-ui-badge--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}

export default SteelBadge;