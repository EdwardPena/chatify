import { MessageCircleIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";

function NoChatsFound() {
  const { setActiveTab } = useChatStore();

  return (
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
      <div className="size-14 bg-brand/10 rounded-2xl flex items-center justify-center">
        <MessageCircleIcon className="size-7 text-brand-soft" />
      </div>
      <div>
        <h4 className="text-slate-200 text-sm font-medium mb-1">
          No conversations yet
        </h4>
        <p className="text-slate-500 text-xs px-6">
          Start a new chat by selecting a contact from the contacts tab
        </p>
      </div>
      <button
        onClick={() => setActiveTab("contacts")}
        className="px-4 py-2 text-xs text-brand-soft bg-brand/10 rounded-lg hover:bg-brand/20 transition-colors cursor-pointer"
      >
        Find contacts
      </button>
    </div>
  );
}
export default NoChatsFound;
