import { cn } from "@/utils/format";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("relative flex items-center justify-center text-white", className)}>
      <div className="absolute inset-0 rounded-full bg-white/8 blur-2xl" />
      <svg className="relative h-full w-full" viewBox="0 0 128 116" fill="none">
        <path d="M32 44v-9c0-17.673 14.327-32 32-32s32 14.327 32 32v9" stroke="currentColor" strokeLinecap="round" strokeWidth="6" />
        <path d="M16 44h88l-9 58H29L16 44Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="6" />
        <path d="m50 66 11 11 20-24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="6" />
        <path d="M61 108h18" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
        <path d="M82 108h30" stroke="currentColor" strokeLinecap="round" strokeWidth="5" />
      </svg>
    </div>
  );
}