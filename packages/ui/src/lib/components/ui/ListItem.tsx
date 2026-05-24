import { type LiHTMLAttributes } from "react";

interface ListItemProps extends LiHTMLAttributes<HTMLLIElement> {
  icon?: string;
  active?: boolean;
}

export function ListItem({ icon, active = false, className = "", children, ...rest }: ListItemProps) {
  return (
    <li
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all cursor-pointer ${
        active
          ? "bg-[rgba(0,242,254,0.06)] border-l-2 border-[#00f2fe] text-white"
          : "text-slate-400 hover:text-white hover:bg-[rgba(255,255,255,0.02)]"
      } ${className}`}
      {...rest}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </li>
  );
}
