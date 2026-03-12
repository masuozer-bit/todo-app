import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ThemeProvider";
import ErrorBoundary from "@/components/ErrorBoundary";
import "./globals.css";

export const metadata: Metadata = {
  title: "todos",
  description: "A minimalist to-do app",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <ThemeProvider>{children}</ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
