import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-game",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Tiny Farm Empire",
  description: "Уютная idle-аркада: собирай урожай, строй машины, нанимай работников и расширяй ферму.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#8fd36a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={rubik.variable}>
      <body>{children}</body>
    </html>
  );
}
