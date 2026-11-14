"use client";

/**
 * PDFDock — brand mark + wordmark, in the FreeSeak design language
 * (Discovery Blue, Plus Jakarta Sans display face).
 */

import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export function LogoMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* the page */}
      <path
        d="M12 4h16l8 8v26a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z"
        fill="#173B70"
      />
      <path d="M28 4v6a2 2 0 0 0 2 2h6" fill="#3979E8" />
      {/* the wave under the dock */}
      <path
        d="M8 31c3.5 0 3.5 3 7 3s3.5-3 7-3 3.5 3 7 3 3.5-3 7-3"
        stroke="#20B99A"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
      {/* the pen stroke */}
      <path
        d="M13 21h15"
        stroke="#FFFFFF"
        strokeWidth="2.6"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="font-display text-[17px] font-extrabold tracking-tight text-foreground">
      PDF<span className="text-primary">Dock</span>
    </span>
  );
}

export function LogoSlot({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label={`${SITE_NAME} — ${SITE_TAGLINE}`}
      className="flex items-center gap-2.5"
    >
      <LogoMark className="size-9" />
      <span className="flex flex-col gap-[2px]">
        <Wordmark />
        <span className="text-[10.5px] font-semibold tracking-wide text-muted-foreground">
          free · private · in-browser
        </span>
      </span>
    </Link>
  );
}
