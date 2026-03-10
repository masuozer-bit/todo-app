"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { Todo } from "@/lib/types";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications(todos?: Todo[]) {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [swRegistration, setSwRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const notifiedRef = useRef<Set<string>>(new Set());
  const todosRef = useRef(todos ?? []);
  todosRef.current = todos ?? [];

  // Register service worker and check existing subscription on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setPermission(Notification.permission);

    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        setSwRegistration(reg);
        const existing = await reg.pushManager.getSubscription();
        setIsSubscribed(!!existing);
      })
      .catch(() => {
        // SW registration failed (e.g. HTTP in non-localhost)
      });
  }, []);

  const subscribe = useCallback(async () => {
    if (!("Notification" in window) || !("PushManager" in window)) return;

    // Request permission if not yet granted
    let perm = Notification.permission;
    if (perm === "denied") return;
    if (perm !== "granted") {
      perm = await Notification.requestPermission();
      setPermission(perm);
    }
    if (perm !== "granted") return;

    try {
      let reg = swRegistration;
      if (!reg) {
        reg = await navigator.serviceWorker.register("/sw.js");
        setSwRegistration(reg);
      }

      // Wait for SW to be active
      await navigator.serviceWorker.ready;

      if (!VAPID_PUBLIC_KEY) {
        console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
        return;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      const subJson = subscription.toJSON();
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }, [swRegistration]);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = swRegistration ?? (await navigator.serviceWorker.getRegistration("/sw.js"));
      if (!reg) return;

      const subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        setIsSubscribed(false);
        return;
      }

      await fetch("/api/notifications/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, [swRegistration]);

  // ── Belt-and-suspenders: local check while browser is open ───────────────
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

        const [h, m] = todo.start_time.split(":").map(Number);
        const todoMinutes = h * 60 + m;
        const diff = todoMinutes - currentMinutes;

        const key = `${todo.id}:${todo.start_time}`;
        if (diff >= 0 && diff <= 15 && !notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          const timeLabel = diff === 0 ? "now" : `in ${diff} min`;
          new Notification(todo.title, {
            body: `Due ${timeLabel} (${todo.start_time})`,
            icon: "/favicon.ico",
            tag: todo.id,
          });
        }
      }
    }

    checkUpcoming();
    const interval = setInterval(checkUpcoming, 30_000);
    return () => clearInterval(interval);
  }, [permission]);

  // Reset notified set daily
  useEffect(() => {
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = setTimeout(() => {
      notifiedRef.current.clear();
    }, midnight.getTime() - Date.now());
    return () => clearTimeout(timer);
  }, []);

  return { permission, isSubscribed, subscribe, unsubscribe };
}
