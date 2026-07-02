import { BottomNav } from "@/components/mboacoin/bottom-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-ambient flex min-h-dvh w-full flex-col items-center justify-center lg:py-8">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-card lg:h-[860px] lg:w-[392px] lg:rounded-[2.6rem] lg:border lg:border-border lg:shadow-soft lg:ring-1 lg:ring-black/5">
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">{children}</div>
        <BottomNav />
      </div>
    </div>
  );
}