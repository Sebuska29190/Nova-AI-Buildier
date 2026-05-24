import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, className = "", ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-xs text-slate-400 font-medium">{label}</label>}
        <input
          ref={ref}
          className={`w-full bg-[#0b0f19] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00f2fe] transition-all placeholder-slate-600 ${className}`}
          {...rest}
        />
      </div>
    );
  }
);

Input.displayName = "Input";
