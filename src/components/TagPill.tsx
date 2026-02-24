"use client";

import { X } from "lucide-react";

interface TagPillProps {
  name: string;
  onRemove?: () => void;
  onClick?: () => void;
  selected?: boolean;
  size?: "sm" | "md";
}

export default function TagPill({
  name,
  onRemove,
  onClick,
  selected = false,
  size = "md",
}: TagPillProps) {
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-3 py-1";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-2xl font-medium transition-default ${sizeClasses} ${
        selected
          ? "bg-black text-white dark:bg-white dark:text-black"
          : "glass-card-subtle text-black dark:text-white"
      } ${onClick ? "cursor-pointer hover:opacity-80" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {name}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="hover:opacity-60 transition-default"
          aria-label={`Remove tag ${name}`}
        >
          <X size={12} />
        </button>
      )}
    </span>
  );
}
