import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bombay Beach Biennale Map App",
  description: "Interactive festival map and schedule prototype for the Bombay Beach Biennale.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
