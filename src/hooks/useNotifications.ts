"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Todo } from "@/lib/types";

export function useNotifications(todos: Todo[]) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const notifiedRef = useRef<Set<string>>(new Set());
  const todosRef = useRef(todos);
  todosRef.current = todos;

  // Request permission
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      setPermission("granted");
      return;
    }
    if (Notification.permission !== "denied") {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
  }, []);

  // Check for upcoming tasks
  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    function checkUpcoming() {
      const now = new Date();
      const currentDate =
        now.getFullYear() +
        "-" +
        String(now.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(now.getDate()).padStart(2, "0");
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (const todo of todosRef.current) {
        if (todo.completed) continue;
        if (!todo.due_date || !todo.start_time) continue;
        if (todo.due_date !== currentDate) continue;

        // Parse start_time "HH:MM"
        const [h, m] = todo.start_time.split(":").map(Number);
        const todoMinutes = h * 60 + m;
        const diff = todoMinutes - currentMinutes;

        // Notify 15 minutes before and at task time
        const key = `${todo.id}:${todo.start_time}`;
        if (diff >= 0 && diff <= 15 && !notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          const timeLabel = diff === 0 ? "now" : `in ${diff} min`;
          new Notification(`${todo.title}`, {
            body: `Due ${timeLabel} (${todo.start_time})`,
            icon: "/favicon.ico",
            tag: todo.id,
          });
        }
      }
    }

    // Check immediately and then every 30 seconds
    checkUpcoming();
    const interval = setInterval(checkUpcoming, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Clean up old notification keys daily
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - Date.now();
    const timer = setTimeout(() => {
      notifiedRef.current.clear();
    }, msUntilMidnight);
    return () => clearTimeout(timer);
  }, []);

  return { permission, requestPermission };
}
