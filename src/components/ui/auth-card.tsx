import type { ReactNode } from "react";
import { Logo } from "@/components/ui/logo";

/** One short white card on the page, brand name small on top. Shared by login, password and finish. */
export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border-[1.5px] border-line bg-white p-6 sm:p-8">
        <div className="space-y-2">
          <Logo size="sm" />
          <h1 className="font-display text-[28px] leading-[1.1] tracking-[-0.02em]">{title}</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
