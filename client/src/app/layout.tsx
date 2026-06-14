import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = { title: "Snatched XI", description: "1v1 competitive football draft game" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#262626] font-mono antialiased">{children}</body>
    </html>
  );
}
