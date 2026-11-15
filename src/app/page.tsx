import type { Metadata } from "next";
import { EditorApp } from "@/components/editor/editor-app";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/**
 * The one and only route: the editor. Everything runs client-side, so
 * the page is a thin server shell — metadata + structured data + the
 * app. All interactive content (landing, workspace) is rendered by
 * <EditorApp /> on the client.
 */

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const FAQ_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is PDFDock really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes — completely. No paid tier, no watermark, no daily quota and no account. The editor runs on your own device, so there are no server costs, and no paid API or service is ever contacted.",
      },
    },
    {
      "@type": "Question",
      name: "Are my files uploaded anywhere?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The file stays in your browser's memory and every edit is applied locally. Closing the tab clears everything; the only copy that exists is the one you download.",
      },
    },
    {
      "@type": "Question",
      name: "Can I sign a PDF without printing it?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. The Sign tool opens a drawing pad — use your mouse, trackpad or finger — and inserts your signature with a transparent background at any size and position.",
      },
    },
    {
      "@type": "Question",
      name: "Can I edit the existing text of a paragraph?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Not by rewriting it in place — PDF text is not stored as a flowable document. The professional approach is cover-and-replace: double-click the line with the Select tool and PDFDock covers it and drops your editable copy on top, ready to retype and save.",
      },
    },
    {
      "@type": "Question",
      name: "Does it work with password-protected PDFs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "PDFDock tells you honestly when a PDF is password-protected and refuses to guess. Remove the protection first, then edit it here.",
      },
    },
  ],
};

const APP_JSONLD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: `${SITE_NAME} — Free PDF Editor`,
  url: SITE_URL,
  applicationCategory: "UtilityApplication",
  operatingSystem: "Any (runs in the browser)",
  description:
    "Edit PDFs in your browser: add text, draw signatures, white-out content, highlight, stamp images, fill forms and fix pages. No uploads, no sign-up.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  browserRequirements: "Requires JavaScript",
};

export default function HomePage() {
  return (
    <>
      <EditorApp />
      {[FAQ_JSONLD, APP_JSONLD].map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      ))}
    </>
  );
}
