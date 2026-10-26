import type { Metadata, Viewport } from "next";
import { Rubik } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-game",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Tiny Farm Empire",
  description: "Уютная idle-аркада: собирай урожай, строй машины, нанимай работников и расширяй ферму.",
  // Home-screen app on iPhone: no browser bars, the game's own name.
  appleWebApp: { capable: true, title: "Farm Empire", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#8fd36a",
  // Under the iPhone status bar of the home-screen app: the HUD keeps to env(safe-area-inset-*).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={rubik.variable}>
      <body>
        {/* The browser may offer to install the game before the game code has loaded: keep the offer for the settings button. */}
        <Script id="install-prompt" strategy="beforeInteractive">
          {"addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__installPrompt=e;});"}
        </Script>
        {children}
      </body>
    </html>
  );
}
