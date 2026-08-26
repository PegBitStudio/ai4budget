import DisclaimerModal from "@/components/ui/DisclaimerModal";
import TopHeader from "@/components/navigation/TopHeader";
import BottomNav from "@/components/navigation/BottomNav";
import Sidebar from "@/components/navigation/Sidebar";
import CommandMenu from "@/components/command/CommandMenu";
import DailyQuote from "@/components/ui/DailyQuote";
import { CurrencyProvider } from "@/components/currency/CurrencyProvider";
import { createClient } from "@/lib/supabase/server";

/**
 * The application shell: a persistent rail on desktop, a title bar and bottom
 * bar on mobile. Every authenticated screen renders inside the same frame and
 * the same content width, which is most of what makes a set of pages read as
 * one product.
 *
 * The currency is resolved here, on the server, so the first painted frame is
 * already in the right money. Reading it on the client would mean a page of
 * figures rendering in Naira and then flicking to Euros.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const currencyCode = (user?.user_metadata?.currency as string) ?? null;

  return (
    <CurrencyProvider code={currencyCode}>
      <div className="flex min-h-screen bg-ink-50">
        <DisclaimerModal />
        <CommandMenu />
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <TopHeader />
          <main className="flex-1 pb-24 lg:pb-12">
            <div className="animate-enter mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
              {children}
              {/* Sits below every page rather than on one, so it reads as part
                  of the frame — something the product says, not a card
                  competing with the figures above it. */}
              <div className="mt-12">
                <DailyQuote />
              </div>
            </div>
          </main>
        </div>

        <BottomNav />
      </div>
    </CurrencyProvider>
  );
}
