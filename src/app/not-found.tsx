import Link from "next/link";
import { LogoMark } from "@/components/site/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <LogoMark className="size-12" />
      <h1 className="font-display text-[22px] font-extrabold tracking-tight text-foreground">
        That page drifted away
      </h1>
      <p className="max-w-[380px] text-[13px] leading-relaxed text-muted-foreground">
        There is only one dock here — the editor lives on the home page.
      </p>
      <Link
        href="/"
        className="rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground shadow-sm transition hover:opacity-90"
      >
        Back to the editor
      </Link>
    </div>
  );
}
