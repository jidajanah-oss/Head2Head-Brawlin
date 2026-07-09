import type { HTMLAttributes, ReactNode } from "react";

type SteelCardVariant = "default" | "elevated" | "gold" | "danger";

type SteelCardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  className?: string;
  variant?: SteelCardVariant;
  as?: "article" | "section" | "div";
};

function SteelCard({
  children,
  className = "",
  variant = "default",
  as = "article",
  ...props
}: SteelCardProps) {
  const Component = as;

  return (
    <Component
      className={`steel-ui-card steel-ui-card--${variant} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
}

export default SteelCard;