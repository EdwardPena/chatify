import { useCallback, useEffect, useRef, useState } from "react";
import { CornerUpLeftIcon, HashIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { PERMISSIONS, useServerStore } from "../store/useServerStore";
import { useAuthStore } from "../store/useAuthStore";
import ChannelHeader from "./ChannelHeader";
import ChannelDetailsPanel from "./ChannelDetailsPanel";
import SearchPanel from "./SearchPanel";
import MessageText from "./MessageText";
import DaySeparator from "./DaySeparator";
import { QuotedMessage } from "./ReplyPreview";
import { groupByDay } from "../lib/messageDays";
import MessageInput from "./MessageInput";
import MessagesLoadingSkeleton from "./MessagesLoadingSkeleton";
import VoiceMessagePlayer from "./VoiceMessagePlayer";

// two messages from the same person inside this window render as one block
const GROUPING_WINDOW_MS = 5 * 60 * 1000;

const formatTime = (date) =>
  new Date(date).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

function ChannelContainer() {
  const {
    activeServer,
    activeChannel,
    channelMessages,
    isMessagesLoading,
    members,
    sendChannelMessage,
    searchChannelMessages,
    deleteChannelMessage,
    replyingTo,
    setReplyingTo,
    can,
  } = useServerStore();
  const { authUser } = useAuthStore();
  const [rightPane, setRightPane] = useState("details");
  const [highlightedId, setHighlightedId] = useState(null);
  const messageEndRef = useRef(null);
  const listRef = useRef(null);

  const canModerate = can(PERMISSIONS.MODERATE_MESSAGES);

  // a hit in the search panel scrolls the matching row into view and flashes it
  const jumpToMessage = useCallback((message) => {
    const row = listRef.current?.querySelector(`[data-message="${message._id}"]`);
    if (!row) return;

    row.scrollIntoView({ behavior: "smooth", block: "center" });
    setHighlightedId(message._id);
    setTimeout(() => setHighlightedId(null), 2000);
  }, []);

  useEffect(() => {
    if (messageEndRef.current) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [channelMessages]);

  return (
    <div className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col min-w-0 bg-surface-2">
        <ChannelHeader
          isDetailsOpen={rightPane === "details"}
          onToggleDetails={() =>
            setRightPane(rightPane === "details" ? null : "details")
          }
          isSearchOpen={rightPane === "search"}
          onToggleSearch={() =>
            setRightPane(rightPane === "search" ? "details" : "search")
          }
        />

        <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-6">
          <div>
            {/* the top of every channel explains what the channel is */}
            <div className="panel p-6 mb-8">
              <div className="size-12 rounded-xl bg-brand/15 flex items-center justify-center mb-4">
                <HashIcon className="size-6 text-brand-soft" />
              </div>

              <h2 className="text-2xl font-bold text-slate-100 mb-2">
                Welcome to #{activeChannel.name}
              </h2>
              <p className="text-slate-400 text-sm max-w-xl">
                {activeChannel.topic ||
                  `This is the start of #${activeChannel.name}. Everything posted here is visible to every member of ${activeServer.name}.`}
              </p>

              <div className="flex flex-wrap items-center gap-2 mt-4">
                <span className="auth-badge">
                  <UsersIcon className="size-3 mr-1.5" />
                  {members.length} member{members.length === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-surface-3 text-slate-400">
                  {activeServer.name}
                </span>
              </div>
            </div>

            {isMessagesLoading ? (
              <MessagesLoadingSkeleton />
            ) : (
              <div ref={listRef}>
                {groupByDay(channelMessages).map((section) => (
                  <div key={section.day}>
                    <DaySeparator label={section.label} />

                    <div className="space-y-1">
                      {section.messages.map((msg, index) => (
                        <ChannelMessage
                          key={msg._id}
                          message={msg}
                          previous={section.messages[index - 1]}
                          isMine={msg.senderId?._id === authUser._id}
                    meId={authUser._id}
                          isHighlighted={highlightedId === msg._id}
                          canDelete={
                            canModerate || msg.senderId?._id === authUser._id
                          }
                          onDelete={() => deleteChannelMessage(msg._id)}
                          onReply={() => setReplyingTo(msg)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Scroll target*/}
            <div ref={messageEndRef} />
          </div>
        </div>

        <MessageInput
          onSend={sendChannelMessage}
          placeholder={`Message #${activeChannel.name}...`}
          mentionables={members}
          replyingTo={replyingTo}
          replyAuthor={replyingTo?.senderId?.fullName || ""}
          onCancelReply={() => setReplyingTo(null)}
        />
      </div>

      {rightPane === "details" && (
        <ChannelDetailsPanel onClose={() => setRightPane(null)} />
      )}

      {rightPane === "search" && (
        <SearchPanel
          title={`Search #${activeChannel.name}`}
          onSearch={searchChannelMessages}
          onSelect={jumpToMessage}
          onClose={() => setRightPane("details")}
          resolveSender={(message) => message.senderId || {}}
        />
      )}
    </div>
  );
}

function ChannelMessage({
  message,
  previous,
  isMine,
  meId,
  isHighlighted,
  canDelete,
  onDelete,
  onReply,
}) {
  const sender = message.senderId || {};

  // hide the avatar and the name when the same person just spoke
  const isGrouped =
    previous?.senderId?._id === sender._id &&
    new Date(message.createdAt) - new Date(previous.createdAt) <
      GROUPING_WINDOW_MS;

  return (
    <div
      data-message={message._id}
      className={`group flex gap-3 px-3 py-1 rounded-lg transition-colors ${
        isHighlighted ? "bg-brand/15" : "hover:bg-surface-3/60"
      } ${isGrouped ? "" : "mt-4"} ${message.isOptimistic ? "opacity-60" : ""}`}
    >
      <div className="w-10 flex-shrink-0">
        {!isGrouped && (
          <img
            src={sender.profilePic || "/avatar.png"}
            alt={sender.fullName}
            className="size-10 rounded-full object-cover"
          />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {message.replyTo && (
          <QuotedMessage
            message={message.replyTo}
            authorName={message.replyTo.senderId?.fullName || "someone"}
          />
        )}

        {!isGrouped && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-slate-100 font-semibold text-sm">
              {sender.fullName}
            </span>
            {isMine && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand/15 text-brand-soft">
                You
              </span>
            )}
            <span className="text-slate-600 text-[11px]">
              {formatTime(message.createdAt)}
            </span>
          </div>
        )}

        {message.image && (
          <img
            src={message.image}
            alt="Shared"
            className="rounded-lg h-48 object-cover my-1"
          />
        )}

        {message.audio && (
          <div className="my-1 max-w-sm">
            <VoiceMessagePlayer
              src={message.audio}
              duration={message.audioDuration}
              messageId={message._id}
            />
          </div>
        )}

        {message.text && (
          <p className="text-slate-300 text-sm leading-relaxed break-words">
            <MessageText
              text={message.text}
              mentions={message.mentions}
              meId={meId}
            />
          </p>
        )}
      </div>

      <div className="self-start mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {!message.isOptimistic && (
          <button
            type="button"
            onClick={onReply}
            title="Reply"
            className="icon-btn"
          >
            <CornerUpLeftIcon className="size-4" />
          </button>
        )}

        {canDelete && !message.isOptimistic && (
          <button
            type="button"
            onClick={onDelete}
            title="Delete message"
            className="text-slate-600 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Trash2Icon className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

export default ChannelContainer;
