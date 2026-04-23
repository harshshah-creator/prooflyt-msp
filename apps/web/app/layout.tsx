import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Prooflyt — DPDP Compliance Operating System",
  description: "Discover personal data, run compliance workflows, and produce audit-ready evidence for India's DPDP Act.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
