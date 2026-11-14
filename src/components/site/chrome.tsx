"use client";

/**
 * PDFDock — header and footer for the landing page.
 */

import { useTheme } from "next-themes";
import { Moon, ShieldCheck, Sun } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogoSlot } from "./logo";
import { OPERATOR_EXPERIENCE, OPERATOR_NAME, SITE_NAME } from "@/lib/site";

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex h-[62px] w-full max-w-[1120px] items-center gap-3 px-4 sm:px-6">
        <LogoSlot />
        <nav className="ml-auto flex items-center gap-1" aria-label="Main">
          <a
            href="#how"
            className="hidden rounded-lg px-3 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            How it works
          </a>
          <a
            href="#faq"
            className="hidden rounded-lg px-3 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            FAQ
          </a>
          <a
            href="#open"
            className="hidden rounded-lg px-3 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
          >
            Open a PDF
          </a>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle dark mode"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun className="hidden size-[18px] dark:block" aria-hidden="true" />
            <Moon className="size-[18px] dark:hidden" aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-card">
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-4 py-7 text-center sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:text-left">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-secondary">
            <ShieldCheck className="size-5 text-mint-deep dark:text-mint" aria-hidden="true" />
          </span>
          <p className="max-w-[420px] text-[12.5px] leading-relaxed text-muted-foreground">
            {SITE_NAME} never uploads your files. Every edit, signature and
            export happens inside your browser — privacy by architecture,
            not by promise.
          </p>
        </div>
        <p className="text-[11.5px] font-semibold text-muted-foreground/70">
          Built by {OPERATOR_NAME} — {OPERATOR_EXPERIENCE} ·{" "}
          <Link href="/sitemap.xml" className="underline-offset-2 hover:underline">
            Sitemap
          </Link>
        </p>
      </div>
    </footer>
  );
}
