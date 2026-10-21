import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "surface" | "ghost" | "ink";

export function Button({
  variant = "primary",
  className,
  ref,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; ref?: Ref<HTMLButtonElement> }) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-base font-semibold transition-transform duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-40",
        variant === "primary" && "bg-moss text-surface",
        variant === "surface" && "bg-surface text-ink ring-1 ring-line",
        variant === "ghost" && "bg-transparent text-ink",
        variant === "ink" && "bg-ink text-surface",
        className,
      )}
      {...props}
    />
  );
}