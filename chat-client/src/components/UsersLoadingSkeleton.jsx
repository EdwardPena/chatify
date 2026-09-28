function UsersLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="px-2 py-1.5 rounded-md animate-pulse">
          <div className="flex items-center gap-2">
            <div className="size-6 bg-surface-4 rounded-full"></div>
            <div className="flex-1">
              <div className="h-3 bg-surface-4 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default UsersLoadingSkeleton;
