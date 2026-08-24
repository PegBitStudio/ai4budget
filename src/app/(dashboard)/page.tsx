import dynamic from "next/dynamic";

const DashboardClient = dynamic(() => import("./DashboardClient"), {
  ssr: false,
  loading: () => (
    <div className="px-4 py-6 sm:px-6 md:px-8">
      <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">
        Dashboard
      </h1>
      <div className="mt-6 space-y-4" aria-busy="true" aria-live="polite">
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
