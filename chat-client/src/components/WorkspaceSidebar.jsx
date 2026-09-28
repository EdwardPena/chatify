import { useEffect, useRef, useState } from "react";
import { LoaderIcon, PencilLineIcon, SearchIcon } from "lucide-react";
import { useServerStore } from "../store/useServerStore";
import { useChatStore } from "../store/useChatStore";
import ActiveTabSwitch from "./ActiveTabSwitch";
import ChannelList from "./ChannelList";
import ChatList from "./ChatList";
import ContactList from "./ContactList";
import ServerMenu from "./ServerMenu";
import UserFooterCard from "./UserFooterCard";
import VoiceDock from "./VoiceDock";

// the second column: channels when a server is open, conversations when it is
// the direct messages view
function WorkspaceSidebar() {
  const { activeServer, isServerLoading } = useServerStore();
  const { activeTab, setActiveTab } = useChatStore();
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  // the hint next to the box said ⌘K, so it had better do something
  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key?.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;

      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  return (
    <aside className="w-70 bg-surface-1 border-r border-edge flex flex-col flex-shrink-0">
      <div className="p-3 space-y-3 border-b border-edge">
        {activeServer ? (
          <ServerMenu />
        ) : (
          <div className="flex items-center justify-between px-2 py-1.5">
            <h2 className="text-slate-100 font-semibold truncate">
              Direct Messages
            </h2>

            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              title="Start a new conversation"
              className="icon-btn"
            >
              <PencilLineIcon className="size-4" />
            </button>
          </div>
        )}

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-3.5" />

          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to..."
            className="w-full bg-surface-0 border border-edge rounded-lg py-1.5 pl-9 pr-10 text-xs text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand focus:border-transparent focus:outline-none"
          />

          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600">
            ⌘K
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
        {activeServer ? (
          isServerLoading ? (
            <div className="flex justify-center py-6">
              <LoaderIcon className="size-5 animate-spin text-slate-500" />
            </div>
          ) : (
            <ChannelList query={query} />
          )
        ) : (
          <>
            <ActiveTabSwitch />

            <div className="mt-2 space-y-1">
              {activeTab === "chats" ? (
                <ChatList query={query} />
              ) : (
                <ContactList query={query} />
              )}
            </div>
          </>
        )}
      </div>

      <VoiceDock />
      <UserFooterCard />
    </aside>
  );
}

export default WorkspaceSidebar;
