import "./globals.css";
import type { Metadata } from "next";
import { ClientBootstrap } from "@/component/ClientBootstrap";

export const metadata: Metadata = {
  title: "Thủy Sản Giang Châu - Chấm công",
  description: "Hệ thống chấm công nội bộ Giang Châu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <ClientBootstrap />
        {children}
      </body>
    </html>
  );
}
