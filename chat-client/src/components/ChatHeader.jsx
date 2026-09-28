import { PhoneIcon, SearchIcon, VideoIcon, XIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useEffect } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";

function ChatHeader({ isSearchOpen, onToggleSearch }) {
  const { selectedUser, setSelectedUser } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, activeCall } = useCallStore();
  const isOnline = onlineUsers?.includes(selectedUser._id);

  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") setSelectedUser(null);
    };

    window.addEventListener("keydown", handleEscKey);

    // cleanup function
    return () => window.removeEventListener("keydown", handleEscKey);
  }, [setSelectedUser]);

  return (
    <header className="h-16 px-5 flex justify-between items-center border-b border-edge flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={selectedUser.profilePic || "/avatar.png"}
            alt={selectedUser.fullName}
            className="size-9 rounded-full object-cover"
          />
          {isOnline && (
            <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 border-2 border-surface-2" />
          )}
        </div>

        <div>
          <h1 className="text-slate-100 font-semibold">
            {selectedUser.fullName}
          </h1>
          <p className="text-slate-500 text-xs">
            @{selectedUser.username} · {isOnline ? "Online" : "Offline"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSearch}
          title="Search this conversation"
          className={isSearchOpen ? "text-brand-soft cursor-pointer" : "icon-btn"}
        >
          <SearchIcon className="size-4.5" />
        </button>

        <button
          type="button"
          onClick={() => startCall(selectedUser, false)}
          disabled={!isOnline || Boolean(activeCall)}
          title={isOnline ? "Start a call" : "They are offline"}
          className="icon-btn disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PhoneIcon className="size-4.5" />
        </button>

        <button
          type="button"
          onClick={() => startCall(selectedUser, true)}
          disabled={!isOnline || Boolean(activeCall)}
          title={isOnline ? "Start a video call" : "They are offline"}
          className="icon-btn disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <VideoIcon className="size-4.5" />
        </button>

        <button
          type="button"
          onClick={() => setSelectedUser(null)}
          className="icon-btn"
          title="Close conversation"
        >
          <XIcon className="size-4.5" />
        </button>
      </div>
    </header>
  );
}
export default ChatHeader;
