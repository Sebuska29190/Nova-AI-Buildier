import { type ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  icon = "",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  const base = "inline-flex items-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-all duration-150 select-none border";
  const state = disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer";

  const variants: Record<string, string> = {
    primary: "bg-nova-accent text-nova-bg border-nova-accent hover:brightness-110 active:brightness-95 shadow-[0_2px_10px_rgba(45,212,191,0.25)] hover:shadow-[0_4px_16px_rgba(45,212,191,0.35)] hover:-translate-y-[1px] active:translate-y-0",
    secondary: "bg-nova-surface text-nova-foreground border-nova-border-2 hover:border-nova-accent hover:text-nova-accent hover:bg-nova-surface-2",
    ghost: "bg-transparent text-nova-muted border-transparent hover:bg-nova-surface hover:text-nova-foreground",
    danger: "bg-red-900/20 text-red-400 border-red-800/30 hover:bg-red-900/40 hover:border-red-500",
  };

  const sizes: Record<string, string> = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${state} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${className}`}
      {...rest}
    >
      {loading && (
        <span className="inline-block w-[1em] h-[1em] border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {icon && !loading && <span className="text-[1em] leading-none">{icon}</span>}
      {children && <span className="leading-none">{children}</span>}
    </button>
  );
}
