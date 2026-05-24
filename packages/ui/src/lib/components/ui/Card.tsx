import { type HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "bordered";
  padding?: "sm" | "md" | "lg";
  hover?: boolean;
}

export function Card({
  variant = "default",
  padding = "md",
  hover = false,
  className = "",
  children,
  ...rest
}: CardProps) {
  const variants: Record<string, string> = {
    default: "bg-nova-surface-2 border-nova-border shadow-sm",
    glass: "glass border-nova-border-2",
    bordered: "bg-transparent border-nova-border-3",
  };

  const paddings: Record<string, string> = {
    sm: "p-2",
    md: "px-4 py-3",
    lg: "p-5",
  };

  return (
    <div
      className={`rounded-xl transition-all duration-200 border ${variants[variant] || variants.default} ${paddings[padding] || paddings.md} ${hover ? "card-nova cursor-pointer hover:border-nova-accent hover:shadow-[0_0_12px_rgba(45,212,191,0.15)] hover:-translate-y-0.5" : ""} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
