import type { LucideIcon } from "lucide-react";
import { Package } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon = Package,
  title,
  description,
  action,
  children,
}: EmptyStateProps) {
  return (
    <div className="text-center py-20 px-6 glass rounded-[8px] border border-[rgba(255,255,255,0.9)] dark:border-[rgba(255,255,255,0.1)]">
      <div className="w-12 h-12 rounded-2xl bg-[rgba(0,122,255,0.08)] dark:bg-[rgba(108,167,255,0.12)] flex items-center justify-center mx-auto mb-4">
        <Icon className="h-6 w-6 text-[color:var(--accent)]" />
      </div>
      <div className="flex flex-col gap-1 mb-5">
        <h3 className="text-base font-semibold text-[color:var(--ink)] font-heading tracking-tight">{title}</h3>
        {description && (
          <p className="text-[13px] text-[color:var(--ink-soft)] leading-relaxed max-w-xs mx-auto">
            {description}
          </p>
        )}
      </div>
      {action &&
        (action.href ? (
          <a href={action.href}>
            <Button
              variant="outline"
              className="rounded-full bg-[rgba(0,122,255,0.1)] border-none text-[color:var(--accent)] text-[13px] font-semibold hover:bg-[rgba(0,122,255,0.18)]"
            >
              {action.label}
            </Button>
          </a>
        ) : (
          <Button
            variant="outline"
            onClick={action.onClick}
            className="rounded-full bg-[rgba(0,122,255,0.1)] border-none text-[color:var(--accent)] text-[13px] font-semibold hover:bg-[rgba(0,122,255,0.18)]"
          >
            {action.label}
          </Button>
        ))}
      {children}
    </div>
  );
}
