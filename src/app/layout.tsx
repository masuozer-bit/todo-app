import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/components/I18nProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "todos",
  description: "A minimalist to-do app",
};

// Without viewportFit the safe-area insets stay zero on notched phones
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                  var tint = localStorage.getItem('tint') || 'lavender';
                  document.documentElement.classList.add('tint-' + tint);
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="text-black dark:text-white min-h-screen transition-colors">
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
