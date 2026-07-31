import { Badge } from "@/components/ui/Badge";

interface OpportunityBadgeProps {
  score: number;
  className?: string;
}

const TIERS = [
  { max: 39, label: "Low", variant: "muted" as const },
  { max: 59, label: "Medium", variant: "warning" as const },
  { max: 79, label: "High", variant: "danger" as const },
  { max: 100, label: "Hot", variant: "urgent" as const },
];

/** Higher score = weaker online presence = bigger sales opportunity, so "Hot" reads red, not "Low". */
export function OpportunityBadge({ score, className }: OpportunityBadgeProps) {
  const tier = TIERS.find((t) => score <= t.max) ?? TIERS[TIERS.length - 1];

  return (
    <Badge variant={tier.variant} className={className}>
      {score} · {tier.label}
    </Badge>
  );
}
