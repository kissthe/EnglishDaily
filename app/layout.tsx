import type { Metadata } from "next";
import "./globals.css";
import "./theme.css";
import "./dark.css";
import "./vocabulary.css";
import "./mobile.css";
import {AppTheme} from "./theme-provider";

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
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased"><AppTheme>{children}</AppTheme></body>
    </html>
  );
}
