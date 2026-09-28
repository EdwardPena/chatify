import { useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useContactStore } from "../store/useContactStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();
  const { incomingRequests, getContactRequests } = useContactStore();

  // load once so the badge shows even while the chats tab is open
  useEffect(() => {
    getContactRequests();
  }, [getContactRequests]);

  return (
    <div role="tablist" className="flex gap-1 p-1 bg-surface-0 rounded-lg">
      <button
        role="tab"
        onClick={() => setActiveTab("chats")}
        className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
          activeTab === "chats"
            ? "bg-brand text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Chats
      </button>

      <button
        role="tab"
        onClick={() => setActiveTab("contacts")}
        className={`flex-1 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer ${
          activeTab === "contacts"
            ? "bg-brand text-white"
            : "text-slate-400 hover:text-slate-200"
        }`}
      >
        Contacts
        {incomingRequests.length > 0 && (
          <span className="bg-brand-soft text-white text-[10px] font-semibold rounded-full size-4 flex items-center justify-center">
            {incomingRequests.length > 9 ? "9+" : incomingRequests.length}
          </span>
        )}
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
