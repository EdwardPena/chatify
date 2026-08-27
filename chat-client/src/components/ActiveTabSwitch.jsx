import { useChatStore } from "../store/useChatStore";

function ActiveTabSwitch() {
  const { activeTab, setActiveTab } = useChatStore();

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
        className={`tab flex-1 mr-2 ${
          activeTab === "contacts"
            ? "tab-active bg-cyan-500/20 text-cyan-400"
            : "text-slate-400"
        }`}
      >
        Contacts
      </button>
    </div>
  );
}
export default ActiveTabSwitch;
