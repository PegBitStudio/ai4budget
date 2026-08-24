import FooterDisclaimer from "@/components/ui/FooterDisclaimer";
import DisclaimerModal from "@/components/ui/DisclaimerModal";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DisclaimerModal />
      <main className="flex-1 pb-20">{children}</main>
      <FooterDisclaimer />
    </div>
  );
}
