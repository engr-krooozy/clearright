import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClearRight — Know Your Rights",
  description:
    "Real-time AI legal information assistant. Upload any legal document and talk to Clara — your free, instant rights navigator. Powered by Gemini Live API.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" suppressHydrationWarning>{children}</body>
    </html>
  );
}
