// the date written once at the top of each day's run of messages
function DaySeparator({ label }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <span className="h-px flex-1 bg-edge" />
      <span className="text-[11px] font-medium text-slate-500 px-2 py-0.5 rounded-full bg-surface-3 border border-edge">
        {label}
      </span>
      <span className="h-px flex-1 bg-edge" />
    </div>
  );
}

export default DaySeparator;
