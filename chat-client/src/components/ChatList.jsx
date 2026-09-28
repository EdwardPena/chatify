import { useEffect } from "react";
import UsersLoadingSkeleton from "./UsersLoadingSkeleton";
import NoChatsFound from "./NoChatsFound";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";

function ChatsList({ query = "" }) {
  const {
    getMyChatPartners,
    chats,
    isUsersLoading,
    selectedUser,
    setSelectedUser,
    unreadCounts,
  } = useChatStore();
  const { onlineUsers } = useAuthStore();

  useEffect(() => {
    getMyChatPartners();
  }, [getMyChatPartners]);

  // the sidebar search filters what is already loaded, no round trip needed
  const term = query.trim().toLowerCase();
  const visibleChats = term
    ? chats.filter(
        (chat) =>
          chat.fullName.toLowerCase().includes(term) ||
          chat.username?.toLowerCase().includes(term),
      )
    : chats;

  if (isUsersLoading) return <UsersLoadingSkeleton />;
  if (chats.length === 0) return <NoChatsFound />;

  return (
    <>
      <h5 className="sidebar-heading mb-1">Direct messages</h5>

      {visibleChats.map((chat) => {
        const isOnline = onlineUsers?.includes(chat._id);
        const unreadCount = unreadCounts?.[chat._id] || 0;

        return (
          <div
            key={chat._id}
            className={`sidebar-item ${
              selectedUser?._id === chat._id ? "sidebar-item-active" : ""
            }`}
            onClick={() => setSelectedUser(chat)}
          >
            <div className="relative flex-shrink-0">
              <img
                src={chat.profilePic || "/avatar.png"}
                alt={chat.fullName}
                className="size-6 rounded-full object-cover"
              />
              {isOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-green-500 border-2 border-surface-1" />
              )}
            </div>

            <span className="truncate flex-1">{chat.fullName}</span>

            {unreadCount > 0 && (
              <span className="bg-brand text-white text-[10px] font-semibold rounded-full size-4.5 flex items-center justify-center flex-shrink-0">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}
export default ChatsList;
