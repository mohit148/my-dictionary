import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "secondary", size = "md", ...p }, ref,
) {
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        variant === "primary" && "border-accent-strong bg-accent-strong text-on-accent hover:brightness-110",
        variant === "secondary" && "border-border bg-surface text-foreground hover:bg-accent-soft",
        variant === "ghost" && "border-transparent text-muted hover:bg-accent-soft hover:text-foreground",
        variant === "danger" && "border-transparent text-danger hover:bg-danger-soft",
        className,
      )}
      {...p}
    />
  );
});

const field =
  "w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 transition-colors hover:border-accent/40 focus:border-accent focus:outline-none aria-[invalid=true]:border-danger";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...p }, ref) {
    return <input ref={ref} className={cn(field, "h-10", className)} {...p} />;
  },
);
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...p }, ref) {
    return <textarea ref={ref} className={cn(field, "min-h-20 py-2 leading-relaxed", className)} {...p} />;
  },
);

export function Label({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-medium", className)} {...p} />;
}

export function FieldError({ children, id }: { children?: React.ReactNode; id?: string }) {
  if (!children) return null;
  return <p id={id} role="alert" className="mt-1.5 text-sm text-danger">{children}</p>;
}

export function Chip({
  children, tone = "accent", className,
}: { children: React.ReactNode; tone?: "accent" | "ok" | "warn" | "danger" | "neutral"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "accent" && "bg-accent-soft text-link",
        tone === "ok" && "bg-ok-soft text-ok",
        tone === "warn" && "bg-warn-soft text-warn",
        tone === "danger" && "bg-danger-soft text-danger",
        tone === "neutral" && "bg-black/5 text-muted",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-surface", className)} {...p} />;
}
