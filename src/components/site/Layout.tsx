import type { ReactNode } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { MobileBottomNav } from "./MobileBottomNav";
import { PromoBanner } from "./PromoBanner";
import { WhatsAppButton } from "./WhatsAppButton";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col overflow-x-hidden">
      <PromoBanner />
      <Header />
      <main className="flex-1 pb-16 lg:pb-0 min-w-0">{children}</main>

      <Footer />
      <MobileBottomNav />
      <WhatsAppButton />
    </div>
  );
}
