"use client";

import { useEffect } from "react";

/**
 * iOS Safari does not resize the layout viewport for the on-screen keyboard.
 * It shrinks and shifts the *visual* viewport instead, and after the keyboard
 * closes it does not reliably put it back. The app then sits squeezed into the
 * upper part of the screen with the bottom navigation in the middle of it.
 *
 * So the shell stops trusting 100dvh on a phone and follows the visual
 * viewport. The hook publishes three custom properties on <html>:
 *
 *   --vvh  height of the visual viewport
 *   --vvt  how far down the visual viewport starts
 *   --vvb  how much layout viewport is left below it, for anything that
 *          stays fixed to the window, such as the toast stack
 *
 * It also marks <html> with `shell-locked`, which is what turns off document
 * scrolling and rubber banding on a phone. Without visualViewport support the
 * hook does nothing and the CSS keeps its own fallback values.
 */
export function useVisualViewport() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    root.classList.add("shell-locked");

    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const apply = () => {
      const height = vv.height;
      const top = vv.offsetTop;
      root.style.setProperty("--vvh", `${Math.round(height)}px`);
      root.style.setProperty("--vvt", `${Math.round(top)}px`);
      root.style.setProperty(
        "--vvb",
        `${Math.max(0, Math.round(window.innerHeight - height - top))}px`
      );

      // Nearly full height again means the keyboard is gone. Safari can leave
      // the page scrolled; put it back in the next frame and once more after
      // the keyboard animation has finished.
      if (window.innerWidth < 768 && height >= window.innerHeight - 40) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => window.scrollTo(0, 0));
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => window.scrollTo(0, 0), 100);
      }
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
      root.classList.remove("shell-locked");
      root.style.removeProperty("--vvh");
      root.style.removeProperty("--vvt");
      root.style.removeProperty("--vvb");
    };
  }, []);
}
