import {
  BellIcon,
  BellOffIcon,
  HashIcon,
  PanelRightIcon,
  SearchIcon,
} from "lucide-react";
import { useServerStore } from "../store/useServerStore";
import { useAuthStore } from "../store/useAuthStore";

function ChannelHeader({ isDetailsOpen, onToggleDetails, isSearchOpen, onToggleSearch }) {
  const { activeServer, activeChannel, members, isMuted, toggleMuteChannel } =
    useServerStore();
  const { onlineUsers } = useAuthStore();

  const muted = isMuted(activeChannel._id);

  // the stack of faces on the right, online people first so it stays useful
  const facePile = [...members]
    .sort(
      (a, b) =>
        Number(onlineUsers?.includes(b._id)) -
        Number(onlineUsers?.includes(a._id)),
    )
    .slice(0, 3);
  const overflow = members.length - facePile.length;

  return (
    <header className="h-16 px-5 flex items-center gap-3 border-b border-edge flex-shrink-0">
      <div className="size-8 rounded-lg bg-brand/15 flex items-center justify-center flex-shrink-0">
        <HashIcon className="size-4 text-brand-soft" />
      </div>

      <div className="min-w-0">
        <h1 className="text-slate-100 font-semibold truncate">
          {activeChannel.name}
        </h1>
        <p className="text-slate-500 text-xs truncate">
          {activeChannel.topic || activeServer.name}
        </p>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden lg:flex items-center">
          {facePile.map((member) => (
            <img
              key={member._id}
              src={member.profilePic || "/avatar.png"}
              alt={member.fullName}
              title={member.fullName}
              className="size-7 rounded-full object-cover border-2 border-surface-2 -ml-2 first:ml-0"
            />
          ))}

          {overflow > 0 && (
            <span className="size-7 rounded-full bg-surface-3 border-2 border-surface-2 -ml-2 flex items-center justify-center text-[10px] text-slate-300">
              +{overflow}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleSearch}
          title="Search this channel"
          className={isSearchOpen ? "text-brand-soft cursor-pointer" : "icon-btn"}
        >
          <SearchIcon className="size-4.5" />
        </button>

        <button
          type="button"
          onClick={() => toggleMuteChannel(activeChannel._id)}
          title={
            muted
              ? "Muted: no badge or sound here, except when you are mentioned"
              : "Mute this channel"
          }
          className={
            muted ? "text-amber-400 cursor-pointer inline-flex items-center" : "icon-btn"
          }
        >
          {muted ? (
            <BellOffIcon className="size-4.5" />
          ) : (
            <BellIcon className="size-4.5" />
          )}
        </button>

        <button
          type="button"
          onClick={onToggleDetails}
          title="Channel details"
          className={isDetailsOpen ? "text-brand-soft cursor-pointer" : "icon-btn"}
        >
          <PanelRightIcon className="size-4.5" />
        </button>
      </div>
    </header>
  );
}

export default ChannelHeader;
