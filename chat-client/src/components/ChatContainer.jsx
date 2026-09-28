import { useCallback, useEffect, useRef, useState } from "react";
import { CornerUpLeftIcon, Trash2Icon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { groupByDay } from "../lib/messageDays";
import ChatHeader from "./ChatHeader";
import NoChatHistoryPlaceholder from "./NoChatHistoryPlaceholder";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import SearchPanel from "./SearchPanel";
import MessageText from "./MessageText";
import DaySeparator from "./DaySeparator";
import MessageStatus from "./MessageStatus";
import { QuotedMessage } from "./ReplyPreview";

function ChatContainer() {
  const {
    selectedUser,
    getMessagesByUserId,
    messages,
    isMessagesLoading,
    sendMessage,
    searchMessages,
    deleteMessage,
    replyingTo,
    setReplyingTo,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState(null);
  const messageEndRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    getMessagesByUserId(selectedUser._id);
  }, [selectedUser, getMessagesByUserId]);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const jumpToMessage = useCallback((message) => {
    const row = listRef.current?.querySelector(`[data-message="${message._id}"]`);
    if (!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(message._id);
    setTimeout(() => setHighlightedId(null), 2000);
  }, []);

  // only two people are ever in a direct message, so a name never needs a lookup
  const nameOf = (senderId) =>
    senderId === authUser._id ? "You" : selectedUser.fullName;

  return (
    <div className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
        <ChatHeader
          isSearchOpen={isSearchOpen}
          onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        />

        <div className="flex-1 px-6 overflow-y-auto scrollbar-thin py-6">
          {messages.length > 0 && !isMessagesLoading ? (
            <div ref={listRef}>
              {groupByDay(messages).map((section) => (
                <div key={section.day}>
                  <DaySeparator label={section.label} />

                  <div className="space-y-4">
                    {section.messages.map((msg) => {
                      const isMine = msg.senderId === authUser._id;

                      return (
                        <div
                          key={msg._id}
                          data-message={msg._id}
                          className={`chat group ${isMine ? "chat-end" : "chat-start"}`}
                        >
                          <div
                            className={`chat-bubble relative ${
                              isMine
                                ? "bg-brand text-white"
                                : "bg-surface-3 text-slate-200"
                            } ${msg.isOptimistic ? "opacity-60" : ""} ${
                              highlightedId === msg._id
                                ? "ring-2 ring-brand-soft"
                                : ""
                            }`}
                          >
                            {/* the controls sit outside the bubble, on the side
                                the bubble is not hugging */}
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                                isMine ? "-left-14" : "-right-14"
                              }`}
                            >
                              <button
                                type="button"
                                onClick={() => setReplyingTo(msg)}
                                title="Reply"
                                className="icon-btn"
                              >
                                <CornerUpLeftIcon className="size-4" />
                              </button>

                              {isMine && !msg.isOptimistic && (
                                <button
                                  type="button"
                                  onClick={() => deleteMessage(msg._id)}
                                  title="Delete message"
                                  className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                                >
                                  <Trash2Icon className="size-3.5" />
                                </button>
                              )}
                            </div>

                            {msg.replyTo && (
                              <QuotedMessage
                                message={msg.replyTo}
                                authorName={nameOf(
                                  msg.replyTo.senderId?._id ||
                                    msg.replyTo.senderId,
                                )}
                                isMine={isMine}
                              />
                            )}

                            {msg.image && (
                              <img
                                src={msg.image}
                                alt="Shared"
                                className="rounded-lg h-48 object-cover"
                              />
                            )}
                            {msg.audio && (
                              <VoiceMessagePlayer
                                src={msg.audio}
                                duration={msg.audioDuration}
                                messageId={msg._id}
                                isMine={isMine}
                              />
                            )}
                            {msg.text && (
                              <p className="mt-1">
                                <MessageText
                                  text={msg.text}
                                  mentions={msg.mentions}
                                  meId={authUser._id}
                                />
                              </p>
                            )}

                            <p className="text-xs mt-1 opacity-75 flex items-center gap-1 justify-end">
                              {new Date(msg.createdAt).toLocaleTimeString(
                                undefined,
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                              {isMine && <MessageStatus status={msg.status} />}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Scroll target*/}
              <div ref={messageEndRef} />
            </div>
          ) : isMessagesLoading ? (
            <MessagesLoadingSkeleton />
          ) : (
            <NoChatHistoryPlaceholder name={selectedUser.fullName} />
          )}
        </div>

        <MessageInput
          onSend={sendMessage}
          placeholder={`Message ${selectedUser.fullName}...`}
          mentionables={[selectedUser]}
          replyingTo={replyingTo}
          replyAuthor={
            replyingTo
              ? nameOf(replyingTo.senderId?._id || replyingTo.senderId)
              : ""
          }
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>

      {isSearchOpen && (
        <SearchPanel
          title={`Search with ${selectedUser.fullName}`}
          onSearch={searchMessages}
          onSelect={jumpToMessage}
          onClose={() => setIsSearchOpen(false)}
          resolveSender={(message) =>
            message.senderId === authUser._id ? authUser : selectedUser
          }
        />
      )}
    </div>
  );
}

export default ChatContainer;
