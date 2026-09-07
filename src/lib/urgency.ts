import type { CSSProperties } from "react";

export type Urgency = "overdue" | "today" | "soon" | "normal";

/**
 * One badge look for "how urgent is this", used by the sidebar counts and
 * the project badges.
 */
export const URGENCY_STYLE: Record<Urgency, CSSProperties> = {
  overdue: {
    backgroundColor: "rgba(239,68,68,0.18)",
    color: "#f87171",
    backdropFilter: "blur(8px)",
    animation: "urgency-pulse 2.5s ease-in-out infinite",
  },
  today: {
    backgroundColor: "rgba(245,158,11,0.18)",
    color: "#fbbf24",
    backdropFilter: "blur(8px)",
    animation: "urgency-pulse 2.5s ease-in-out infinite",
  },
  soon: {
    backgroundColor: "rgba(59,130,246,0.16)",
    color: "#60a5fa",
    backdropFilter: "blur(8px)",
  },
  normal: {
    backgroundColor: "rgba(120,120,120,0.12)",
    color: "rgba(140,140,140,0.95)",
  },
};

export const URGENCY_BADGE_CLASS =
  "min-w-[18px] h-[18px] rounded-full text-[11px] font-semibold flex items-center justify-center px-1 tabular-nums leading-none";
