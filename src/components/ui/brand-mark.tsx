import { cn } from "@/utils/format";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-[0_18px_40px_rgba(5,13,42,0.28)]",
        className
      )}
    >
      <div className="absolute inset-2 rounded-[1.35rem] border border-white/10" />
      <div className="absolute -left-5 top-2 h-14 w-14 rounded-full bg-white/12 blur-2xl" />
      <div className="absolute -bottom-6 right-0 h-16 w-16 rounded-full bg-[#8cabff]/35 blur-2xl" />
      <svg className="relative h-[58%] w-[58%] text-white" viewBox="0 0 64 64" fill="none">
        <path d="M32 8 49 18v14c0 11.046-7.163 20.491-17 24-9.837-3.509-17-12.954-17-24V18L32 8Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="3.5" />
        <path d="m24 33.5 6 6 11-13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
      </svg>
    </div>
  );
}