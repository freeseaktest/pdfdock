import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-jakarta",
});

/**
 * GitHub Pages sub-path (matches next.config.ts and deploy-pages.yml).
 * Icon <link> hrefs are NOT auto-prefixed by Next, so they are built
 * here. Unset (Cloudflare / custom domain / root repo) → "" → root paths.
 */
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Free PDF Editor Online — Add Text, Sign & White-Out, No Upload | PDFDock",
    template: "%s | PDFDock",
  },
  description:
    "Edit PDFs free in your browser: add text, draw signatures, white-out content, highlight, stamp images, fill forms and fix pages. No sign-up, no uploads — nothing leaves your device.",
  keywords: [
    "pdf editor",
    "edit pdf",
    "free pdf editor",
    "pdf editor online free no sign up",
    "add text to pdf",
    "sign pdf online",
    "white out pdf",
    "redact pdf free",
    "fill pdf form online free",
    "annotate pdf",
    "edit pdf without uploading",
  ],
  icons: {
    icon: [
      { url: `${BASE_PATH}/favicon.svg`, type: "image/svg+xml" },
      { url: `${BASE_PATH}/favicon-32.png`, sizes: "32x32", type: "image/png" },
      { url: `${BASE_PATH}/favicon-16.png`, sizes: "16x16", type: "image/png" },
    ],
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
  openGraph: {
    title: "PDFDock — Free PDF Editor in Your Browser",
    description:
      "Add text, sign, white-out, highlight, stamp and fill forms — 100% in your browser. No uploads, no sign-up, no limits.",
    siteName: SITE_NAME,
    type: "website",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — ${SITE_TAGLINE}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PDFDock — Free PDF Editor in Your Browser",
    description:
      "Add text, sign, white-out, highlight, stamp and fill forms — 100% in your browser.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F3F6FA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} flex min-h-[100dvh] flex-col font-sans antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
