import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WTG Downdetector",
  description: "Internal service outage detector",
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
