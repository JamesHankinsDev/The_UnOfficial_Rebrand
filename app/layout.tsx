import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { CartDrawer } from "@/components/merch/CartDrawer";
import { Toaster } from "react-hot-toast";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";

const baseUrl =
  process.env.NEXT_PUBLIC_BASE_URL || "https://the-un-official.com";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "The UnOfficial — NBA Analytics & Takes",
    template: "%s | The UnOfficial",
  },
  description:
    "Serious Fans, UnSerious Takes. NBA analytics blog covering player valuations, contract analysis, draft evaluation, and the chaos of running an NBA franchise.",
  keywords: [
    "The UnOfficial",
    "NBA analytics",
    "NBA blog",
    "basketball analytics",
    "NBA contract analysis",
    "NBA draft",
    "player valuation",
    "NBA takes",
    "basketball blog",
    "NBA data",
    "NBA opinions",
  ],
  authors: [{ name: "The UnOfficial" }],
  creator: "The UnOfficial",
  publisher: "The UnOfficial",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: baseUrl,
    siteName: "The UnOfficial",
    title: "The UnOfficial — NBA Analytics & Takes",
    description:
      "Serious Fans, UnSerious Takes. NBA analytics without the spin.",
    images: [
      {
        url: "/icon.png",
        width: 1200,
        height: 630,
        alt: "The UnOfficial — NBA Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@TheUnOfficial",
    creator: "@TheUnOfficial",
    title: "The UnOfficial — NBA Analytics & Takes",
    description:
      "Serious Fans, UnSerious Takes. NBA analytics without the spin.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: baseUrl,
    types: {
      'application/rss+xml': `${baseUrl}/feed.xml`,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        <OrganizationJsonLd baseUrl={baseUrl} />
        <WebSiteJsonLd baseUrl={baseUrl} />
        <AuthProvider>
          <CartProvider>
            {children}
            <CartDrawer />
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "#111118",
                  color: "#e8e6e3",
                  border: "1px solid #1e1e2a",
                  fontFamily: "Space Mono, monospace",
                  fontSize: "13px",
                },
                success: {
                  iconTheme: { primary: "#fbbf24", secondary: "#0a0a0f" },
                },
                error: {
                  iconTheme: { primary: "#ef4444", secondary: "#0a0a0f" },
                },
              }}
            />
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
