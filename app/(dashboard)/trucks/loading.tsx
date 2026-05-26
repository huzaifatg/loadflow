export default function TrucksLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="h-4 w-72 skeleton rounded-lg mt-2" />
        </div>
        <div className="h-10 w-32 skeleton rounded-lg" />
      </div>
      <div className="h-10 w-72 skeleton rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-900/5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 skeleton rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 skeleton rounded" />
                <div className="h-3 w-16 skeleton rounded" />
              </div>
            </div>
            <div className="h-2 w-full skeleton rounded-full" />
            <div className="flex justify-between">
              <div className="h-3 w-20 skeleton rounded" />
              <div className="h-5 w-16 skeleton rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
