import DisclaimerModal from "@/components/ui/DisclaimerModal";
import TopHeader from "@/components/navigation/TopHeader";
import BottomNav from "@/components/navigation/BottomNav";
import Sidebar from "@/components/navigation/Sidebar";

/**
 * The application shell: a persistent rail on desktop, a title bar and bottom
 * bar on mobile. Every authenticated screen renders inside the same frame and
 * the same content width, which is most of what makes a set of pages read as
 * one product.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ink-50">
      <DisclaimerModal />
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopHeader />
        <main className="flex-1 pb-24 lg:pb-12">
          <div className="animate-enter mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
            {children}
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
