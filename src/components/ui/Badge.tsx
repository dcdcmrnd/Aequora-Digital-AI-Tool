import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "muted" | "urgent";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-blue-100 text-blue-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    danger: "bg-red-100 text-red-700",
    urgent: "bg-red-100 text-red-700 font-semibold",
    muted: "bg-surface-secondary text-text-secondary",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    urgent: { label: "Urgent", variant: "urgent" },
    high: { label: "High", variant: "warning" },
    medium: { label: "Medium", variant: "default" },
    low: { label: "Low", variant: "muted" },
  };
  const { label, variant } = map[priority] ?? { label: priority, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
    active: { label: "Active", variant: "success" },
    invited: { label: "Invited", variant: "warning" },
    suspended: { label: "Suspended", variant: "danger" },
    "on-hold": { label: "On Hold", variant: "warning" },
    completed: { label: "Completed", variant: "success" },
    archived: { label: "Archived", variant: "muted" },
    backlog: { label: "Backlog", variant: "muted" },
    todo: { label: "To Do", variant: "default" },
    "in-progress": { label: "In Progress", variant: "warning" },
    review: { label: "Review", variant: "default" },
    done: { label: "Done", variant: "success" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "muted" };
  return <Badge variant={variant}>{label}</Badge>;
}
