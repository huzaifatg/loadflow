export default function DeliveriesLoading() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-36 skeleton rounded-lg" />
          <div className="h-4 w-64 skeleton rounded-lg mt-2" />
        </div>
        <div className="h-10 w-36 skeleton rounded-lg" />
      </div>
      <div className="h-10 w-72 skeleton rounded-lg" />
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-900/5 overflow-hidden">
        <div className="p-4 space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="h-4 w-36 skeleton rounded" />
              <div className="h-4 w-48 skeleton rounded flex-1" />
              <div className="h-4 w-24 skeleton rounded" />
              <div className="h-6 w-20 skeleton rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
