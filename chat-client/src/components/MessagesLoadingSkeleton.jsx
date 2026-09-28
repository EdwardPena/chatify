function MessagesLoadingSkeleton() {
  return (
    <div className="space-y-6">
      {[...Array(5)].map((_, index) => (
        <div key={index} className="flex gap-3 animate-pulse">
          <div className="size-10 bg-surface-3 rounded-full flex-shrink-0"></div>
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-surface-3 rounded w-32"></div>
            <div className="h-3 bg-surface-2 rounded w-full max-w-md"></div>
            <div className="h-3 bg-surface-2 rounded w-2/3 max-w-sm"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
export default MessagesLoadingSkeleton;
