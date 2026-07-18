import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { ConvexClientProvider } from "./ConvexClientProvider";
import "./globals.css";

const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  weight: "800",
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "Mule Imposter",
  description: "One of you doesn't know the player.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
