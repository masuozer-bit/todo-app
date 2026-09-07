import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/components/I18nProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

// Three weights, the only ones the design uses
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "todos",
  description: "A minimalist to-do app",
};

// Without viewportFit the safe-area insets stay zero on notched phones.
// interactiveWidget lets the browser resize the layout viewport for the
// keyboard instead of only sliding the visual one out from under the page.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

// Runs before the first paint so nobody sees the wrong theme flash past.
// Keep the accent table in sync with ACCENT_PRESETS in ThemeProvider.tsx.
const THEME_BOOTSTRAP = `(function(){
  try {
    var A = {
      blue:   [["#2A66D8","#1F5ED0","rgba(42,102,216,0.10)"],["#5B8DEF","#7AA3F5","rgba(91,141,239,0.14)"]],
      indigo: [["#5B5BD6","#5048C8","rgba(91,91,214,0.10)"],["#8A8AF0","#A3A3F5","rgba(138,138,240,0.14)"]],
      green:  [["#1F7F4C","#186740","rgba(31,127,76,0.10)"],["#3DBE7A","#5FCD93","rgba(61,190,122,0.14)"]],
      orange: [["#9C600B","#8A5309","rgba(156,96,11,0.10)"],["#E7A33A","#EFB865","rgba(231,163,58,0.14)"]],
      pink:   [["#BE3576","#A32663","rgba(190,53,118,0.10)"],["#E8699F","#EF8AB4","rgba(232,105,159,0.14)"]],
      grey:   [["#5B6470","#4B535D","rgba(91,100,112,0.10)"],["#9AA3B2","#B4BBC7","rgba(154,163,178,0.14)"]]
    };
    var root = document.documentElement;
    var pref = localStorage.getItem("theme");
    var dark = pref === "dark" ? true
      : pref === "light" ? false
      : !(window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches);
    root.classList.toggle("dark", dark);
    if (localStorage.getItem("density") === "compact") root.classList.add("density-compact");
    var set = (A[localStorage.getItem("accent")] || A.blue)[dark ? 1 : 0];
    root.style.setProperty("--accent", set[0]);
    root.style.setProperty("--accent-hover", set[1]);
    root.style.setProperty("--accent-soft", set[2]);
    root.style.setProperty("--accent-contrast", dark ? "#0F1115" : "#FFFFFF");

    // Does the app open on the focus view? Decided here, before the first
    // paint, so the server-rendered shell never flashes past on the way in.
    // The dashboard reads the mark on mount and clears it.
    var params = new URLSearchParams(location.search);
    var deepLink = ["view", "list", "folder", "task", "sel", "dates"]
      .some(function (key) { return params.get(key); });
    if (
      !deepLink &&
      location.pathname.indexOf("/dashboard") === 0 &&
      localStorage.getItem("focusStart") !== "off" &&
      localStorage.getItem("focusView") !== "off"
    ) {
      root.setAttribute("data-focus", "pending");
    }
  } catch (e) {}
})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // lang is corrected on mount by I18nProvider from the stored locale
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>
        <ErrorBoundary>
          <ThemeProvider>
            <I18nProvider>
              <ToastProvider>{children}</ToastProvider>
            </I18nProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
