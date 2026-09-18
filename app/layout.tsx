import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "English Daily · 英语每日练习",
  description: "每天一小步，英语更进一步。每日练习、作业反馈与学习记录。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
