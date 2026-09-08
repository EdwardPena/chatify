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
    <div
      role="tablist"
      className="tabs tabs-box tabs-sm bg-transparent p-2 m-2 w-full"
    >
      <button
        role="tab"
        onClick={() => setActiveTab("chats")}
        className={`tab flex-1 ${
          activeTab === "chats"
            ? "tab-active bg-cyan-500/20 text-cyan-400"
            : "text-slate-400"
        }`}
      >
        Chats
      </button>

      <button
        role="tab"
        onClick={() => setActiveTab("contacts")}
        className={`tab flex-1 mr-2 gap-2 ${
          activeTab === "contacts"
            ? "tab-active bg-cyan-500/20 text-cyan-400"
            : "text-slate-400"
        }`}
      >
        Contacts
        {incomingRequests.length > 0 && (
          <span className="bg-cyan-500 text-white text-xs font-semibold rounded-full size-5 flex items-center justify-center">
            {incomingRequests.length > 9 ? "9+" : incomingRequests.length}
          </span>
        )}
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
