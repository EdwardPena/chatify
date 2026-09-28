function Background({ children }) {
  return (
    <div className="min-h-screen bg-surface-0 relative flex items-center justify-center p-4 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:14px_24px]" />

      <div className="absolute top-0 -left-4 size-96 bg-brand opacity-20 blur-[120px]" />

      <div className="absolute bottom-0 -right-4 size-96 bg-violet-500 opacity-20 blur-[120px]" />

      {children}
    </div>
  );
}

export default Background;
