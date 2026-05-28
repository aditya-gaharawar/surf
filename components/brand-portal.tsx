import { ArrowUpRight, Sparkles } from "lucide-react";
import { buttonVariants } from "./ui/button";
import { cn } from "@/lib/utils";

const WEBSPACEAI_URL = "https://webspaceai.in";

export function BrandPortal() {
  return (
    <a
      href={WEBSPACEAI_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open WEBSPACEAI"
      className={cn(
        buttonVariants({ variant: "outline" }),
        "group relative isolate overflow-hidden px-3 py-1.5 shadow-sm",
        "border-accent/30 bg-bg/80 text-fg backdrop-blur",
        "transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:shadow-md",
        "before:absolute before:inset-0 before:-z-10 before:bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklab,var(--accent)_24%,transparent),transparent_38%),linear-gradient(135deg,transparent,color-mix(in_oklab,var(--contrast-2)_12%,transparent))]"
      )}
    >
      <Sparkles className="size-4 text-accent transition-transform duration-300 group-hover:rotate-12" />
      <span className="hidden sm:inline text-xs md:text-sm font-mono tracking-widest">
        WEBSPACEAI
      </span>
      <span className="sm:hidden text-xs font-mono tracking-widest">WSAI</span>
      <ArrowUpRight className="size-3 text-accent transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </a>
  );
}
