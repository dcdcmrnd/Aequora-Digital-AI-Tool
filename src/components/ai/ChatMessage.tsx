"use client";

import { cn } from "@/lib/utils";

interface Props {
  message: { role: "user" | "assistant"; content: string };
}

export function ChatMessage({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold",
          isUser ? "bg-brand-dark text-white" : "bg-brand-primary/10 text-brand-primary"
        )}
      >
        {isUser ? "You" : "AI"}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[80%] rounded-card px-4 py-2.5 text-sm",
          isUser
            ? "bg-brand-dark text-white"
            : "bg-surface-secondary text-text-primary border border-border"
        )}
      >
        {/* Render markdown-like formatting: bold **text**, newlines */}
        <div className="whitespace-pre-wrap leading-relaxed">
          {message.content.split("\n").map((line, i) => (
            <p key={i} className={i > 0 ? "mt-1.5" : ""}>
              {renderInline(line)}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  // Simple bold rendering for **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
