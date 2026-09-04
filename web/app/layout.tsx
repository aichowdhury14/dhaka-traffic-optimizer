import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dhaka Traffic Optimizer",
  description: "Live congestion analytics and route planning for Dhaka, Bangladesh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-slate-100 antialiased">{children}</body>
    </html>
  );
}
