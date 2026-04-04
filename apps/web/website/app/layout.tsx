import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ChatHubProvider } from "@/context/ChatHubContext";
import { Navbar } from "@/components/Navbar";
import { SiteFooter } from "@/components/SiteFooter";
import { GoogleOAuthProvider } from '@react-oauth/google';

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PawSewa - Best Pet Care App",
  description: "Complete pet care solution for pet owners and veterinarians",
  icons: {
    icon: "/brand/image_607767.png",
    apple: "/brand/image_607767.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${outfit.variable}`}>
      <body className="font-sans antialiased">
        <span className="paw-noise" aria-hidden="true" />
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''}>
          <AuthProvider>
            <CartProvider>
              <ChatHubProvider>
                <div className="relative z-[1] flex min-h-screen flex-col">
                  <Navbar />
                  <div className="flex-1">{children}</div>
                  <SiteFooter />
                </div>
              </ChatHubProvider>
            </CartProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
