export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-8">
      <div className="w-full max-w-md rounded-lg bg-paper p-6 shadow-lg sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-ink-900">KoboPilot</h1>
          <p className="mt-1 text-sm text-ink-500">
            Your AI co-pilot for spending, budgeting and saving in Naira
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
