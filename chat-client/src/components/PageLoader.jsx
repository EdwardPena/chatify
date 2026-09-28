import { LoaderIcon } from "lucide-react";

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen bg-surface-0">
      <LoaderIcon className="size-10 animate-spin text-brand" />
    </div>
  );
}

export default PageLoader;
