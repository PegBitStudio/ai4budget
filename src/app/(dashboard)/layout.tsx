import DisclaimerModal from "@/components/ui/DisclaimerModal";
import TopHeader from "@/components/navigation/TopHeader";
import BottomNav from "@/components/navigation/BottomNav";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <DisclaimerModal />
      <TopHeader />
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
