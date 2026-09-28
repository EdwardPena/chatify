import { useState } from "react";
import {
  ChevronDownIcon,
  HashIcon,
  MicOffIcon,
  PlusIcon,
  Trash2Icon,
  Volume2Icon,
} from "lucide-react";
import {
  CHANNEL_TYPES,
  PERMISSIONS,
  useServerStore,
} from "../store/useServerStore";
import { useVoiceStore } from "../store/useVoiceStore";
import CreateChannelModal from "./CreateChannelModal";

function ChannelList({ query = "" }) {
  const {
    activeServer,
    activeChannel,
    selectChannel,
    deleteChannel,
    can,
    badgeFor,
    isMuted,
  } = useServerStore();
  const { activeVoiceChannel } = useVoiceStore();
  const [newChannelType, setNewChannelType] = useState(null);

  // the sidebar search narrows what is already loaded, no round trip needed
  const term = query.trim().toLowerCase();
  const channels = (activeServer?.channels || []).filter(
    (channel) => !term || channel.name.toLowerCase().includes(term),
  );
  const textChannels = channels.filter((c) => c.type === CHANNEL_TYPES.TEXT);
  const voiceChannels = channels.filter((c) => c.type === CHANNEL_TYPES.VOICE);
  const canManage = can(PERMISSIONS.MANAGE_CHANNELS);

  const handleDelete = (e, channel) => {
    // don't open the channel we are about to delete
    e.stopPropagation();

    const confirmed = window.confirm(
      `Delete ${channel.name}? Every message in it is deleted too.`,
    );
    if (confirmed) deleteChannel(channel._id);
  };

  if (term && channels.length === 0) {
    return (
      <p className="text-slate-500 text-xs text-center px-2 py-6">
        No channel matches “{query.trim()}”.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <ChannelSection
          title="Channels"
          addLabel="Create a text channel"
          canManage={canManage}
          onAdd={() => setNewChannelType(CHANNEL_TYPES.TEXT)}
        >
          {textChannels.map((channel) => (
            <ChannelRow
              key={channel._id}
              channel={channel}
              icon={<HashIcon className="size-4 flex-shrink-0" />}
              isActive={activeChannel?._id === channel._id}
              canManage={canManage}
              onSelect={() => selectChannel(channel)}
              onDelete={(e) => handleDelete(e, channel)}
              unread={badgeFor(channel._id)}
              muted={isMuted(channel._id)}
            />
          ))}
        </ChannelSection>

        <ChannelSection
          title="Voice channels"
          addLabel="Create a voice channel"
          canManage={canManage}
          onAdd={() => setNewChannelType(CHANNEL_TYPES.VOICE)}
        >
          {voiceChannels.map((channel) => (
            <div key={channel._id}>
              <ChannelRow
                channel={channel}
                icon={<Volume2Icon className="size-4 flex-shrink-0" />}
                isActive={activeChannel?._id === channel._id}
                isLive={activeVoiceChannel?._id === channel._id}
                canManage={canManage}
                onSelect={() => selectChannel(channel)}
                onDelete={(e) => handleDelete(e, channel)}
                badge={channel.participants?.length || null}
              />

              {/* whoever is talking, listed under the channel they are in */}
              {channel.participants?.map((participant) => (
                <div
                  key={participant._id}
                  className="flex items-center gap-2 pl-8 pr-2 py-1"
                >
                  <img
                    src={participant.profilePic || "/avatar.png"}
                    alt={participant.fullName}
                    className="size-5 rounded-full object-cover"
                  />
                  <span className="text-xs text-slate-400 truncate flex-1">
                    {participant.fullName}
                  </span>
                  {participant.isMuted && (
                    <MicOffIcon className="size-3 text-red-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </ChannelSection>
      </div>

      {newChannelType && (
        <CreateChannelModal
          defaultType={newChannelType}
          onClose={() => setNewChannelType(null)}
        />
      )}
    </>
  );
}

function ChannelSection({ title, addLabel, canManage, onAdd, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <div className="flex items-center justify-between mb-1 group">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="sidebar-heading hover:text-slate-300 transition-colors cursor-pointer"
        >
          <ChevronDownIcon
            className={`size-3 transition-transform ${isOpen ? "" : "-rotate-90"}`}
          />
          {title}
        </button>

        {canManage && (
          <button
            type="button"
            onClick={onAdd}
            title={addLabel}
            className="icon-btn hover:text-brand-soft pr-2"
          >
            <PlusIcon className="size-4" />
          </button>
        )}
      </div>

      {isOpen && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function ChannelRow({
  channel,
  icon,
  isActive,
  isLive,
  canManage,
  onSelect,
  onDelete,
  badge,
  unread,
  muted,
}) {
  return (
    <div
      onClick={onSelect}
      className={`sidebar-item group ${isActive ? "sidebar-item-active" : ""}`}
    >
      {icon}
      <span
        className={`truncate flex-1 ${
          muted ? "opacity-50" : unread ? "text-slate-100 font-medium" : ""
        }`}
      >
        {channel.name}
      </span>

      {unread && (
        <span
          title={
            unread.isMention ? "You were mentioned here" : "Unread messages"
          }
          className={`min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center flex-shrink-0 ${
            unread.isMention
              ? "bg-amber-400 text-slate-900"
              : "bg-brand text-white"
          }`}
        >
          {unread.count > 9 ? "9+" : unread.count}
        </span>
      )}

      {isLive && (
        <span
          title="You are in this call"
          className="size-1.5 rounded-full bg-green-400 flex-shrink-0"
        />
      )}

      {badge ? (
        <span className="text-[10px] text-slate-500 flex-shrink-0">{badge}</span>
      ) : null}

      {canManage && (
        <button
          type="button"
          onClick={onDelete}
          title="Delete channel"
          className="text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer flex-shrink-0"
        >
          <Trash2Icon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export default ChannelList;
