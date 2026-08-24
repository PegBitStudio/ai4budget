import dynamic from "next/dynamic";

const DashboardClient = dynamic(() => import("./DashboardClient"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-4 sm:px-6 md:px-8">
      <div className="mt-4 space-y-4" aria-busy="true" aria-live="polite">
        <div className="h-20 animate-pulse rounded-lg bg-gray-100" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-lg bg-gray-100" />
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  return <DashboardClient />;
}
