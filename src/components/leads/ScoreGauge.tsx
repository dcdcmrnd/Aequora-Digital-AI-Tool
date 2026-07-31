import { cn } from "@/lib/utils";

interface ScoreGaugeProps {
  value: number | null;
  label?: string;
  size?: number;
}

function scoreStrokeColor(value: number | null): string {
  if (value === null) return "stroke-gray-300";
  if (value >= 80) return "stroke-emerald-500";
  if (value >= 50) return "stroke-amber-500";
  return "stroke-danger";
}

/** Hand-built SVG arc — no charting library in this app. */
export function ScoreGauge({ value, label, size = 72 }: ScoreGaugeProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = value === null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-gray-100" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
            className={cn("fill-none transition-[stroke-dasharray]", scoreStrokeColor(value))}
          />
        </svg>
        <div className="text-text-primary absolute inset-0 flex items-center justify-center text-sm font-semibold">
          {value === null ? "—" : value}
        </div>
      </div>
      {label && <span className="text-text-muted text-xs">{label}</span>}
    </div>
  );
}
