interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = "" }: BadgeProps) {
  return (
    <span className={`custom-badge bg-nova-card border border-nova-border-2 text-slate-400 ${className}`}>
      {children}
    </span>
  );
}
