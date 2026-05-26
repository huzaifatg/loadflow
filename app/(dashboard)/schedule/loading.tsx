export default function ScheduleLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="h-4 w-72 skeleton rounded-lg mt-2" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 skeleton rounded-lg" />
          <div className="h-5 w-40 skeleton rounded" />
          <div className="h-9 w-9 skeleton rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white ring-1 ring-gray-200 overflow-hidden">
            <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-200 text-center">
              <div className="h-4 w-20 skeleton rounded mx-auto" />
            </div>
            <div className="p-3 space-y-3 min-h-[120px]">
              <div className="h-16 w-full skeleton rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
