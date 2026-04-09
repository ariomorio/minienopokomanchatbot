import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ミニえのぽこまん | AIコンサルタント",
  description: "あなたの思考を、えのぽこまんが拡張する - AIコンサルティングチャットボット",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
