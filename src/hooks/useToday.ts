"use client";

import { useEffect, useState } from "react";
import { getToday } from "@/lib/date-helpers";

/**
 * Today's date as YYYY-MM-DD in local time, which flips at midnight while
 * the page stays open — otherwise "Today" keeps showing yesterday's tasks.
 */
export function useToday(): string {
  const [today, setToday] = useState(getToday());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleMidnight = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 200);
      timer = setTimeout(() => {
        setToday(getToday());
        scheduleMidnight();
      }, midnight.getTime() - now.getTime());
    };

    scheduleMidnight();

    // A laptop that was asleep over midnight misses the timer
    const onVisible = () => {
      if (!document.hidden) setToday(getToday());
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return today;
}
