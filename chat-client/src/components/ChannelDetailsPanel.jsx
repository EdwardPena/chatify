import { useEffect, useRef, useState } from "react";
import {
  InfoIcon,
  MoreVerticalIcon,
  ShieldIcon,
  UserMinusIcon,
  Volume2Icon,
  XIcon,
} from "lucide-react";
import {
  CHANNEL_TYPES,
  PERMISSIONS,
  useServerStore,
} from "../store/useServerStore";
import { useVoiceStore } from "../store/useVoiceStore";
import { useAuthStore } from "../store/useAuthStore";
import RolesDialog from "./RolesDialog";

// the right rail: what this channel is, who is talking, and who is around
function ChannelDetailsPanel({ onClose }) {
  const { activeServer, activeChannel, members, selectChannel } =
    useServerStore();
  const { activeVoiceChannel } = useVoiceStore();
  const { onlineUsers } = useAuthStore();
  const [isRolesOpen, setIsRolesOpen] = useState(false);

  const liveVoiceChannels = (activeServer.channels || []).filter(
    (channel) =>
      channel.type === CHANNEL_TYPES.VOICE && channel.participants?.length > 0,
  );
  const onlineMembers = members.filter((member) =>
    onlineUsers?.includes(member._id),
  );

  return (
    <>
      <aside className="w-80 bg-surface-1 border-l border-edge flex flex-col flex-shrink-0">
        <header className="h-16 px-5 flex items-center justify-between border-b border-edge">
          <div className="flex items-center gap-2">
            <InfoIcon className="size-4 text-slate-400" />
            <h2 className="text-slate-100 font-semibold text-sm">
              Channel Details
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Close details"
            className="icon-btn"
          >
            <XIcon className="size-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
          <section className="panel p-4">
            <h3 className="field-label">Topic</h3>
            <p className="text-slate-300 text-sm leading-relaxed">
              {activeChannel.topic || "No topic set for this channel yet."}
            </p>
          </section>

          {liveVoiceChannels.length > 0 && (
            <section className="panel p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="field-label mb-0">Live voice</h3>
                <span className="flex items-center gap-1.5 text-[11px] text-green-400">
                  <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
                  Active
                </span>
              </div>

              {liveVoiceChannels.map((channel) => (
                <div key={channel._id} className="flex items-center gap-3">
                  <div className="size-9 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                    <Volume2Icon className="size-4 text-green-400" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-slate-200 text-sm font-medium truncate">
                      {channel.name}
                    </p>
                    <p className="text-slate-500 text-xs truncate">
                      {channel.participants.length} talking
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => selectChannel(channel)}
                    disabled={activeVoiceChannel?._id === channel._id}
                    className="px-3 py-1 rounded-md bg-green-500/15 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  >
                    {activeVoiceChannel?._id === channel._id ? "Joined" : "Join"}
                  </button>
                </div>
              ))}
            </section>
          )}

          <section>
            <div className="flex items-center justify-between px-1 mb-1">
              <h3 className="field-label mb-0">
                Members — {onlineMembers.length} online
              </h3>

              <button
                type="button"
                onClick={() => setIsRolesOpen(true)}
                title="Roles and permissions"
                className="icon-btn"
              >
                <ShieldIcon className="size-3.5" />
              </button>
            </div>

            <div className="space-y-1">
              {members.map((member) => (
                <MemberRow
                  key={member._id}
                  member={member}
                  isOnline={onlineUsers?.includes(member._id)}
                />
              ))}
            </div>
          </section>
        </div>
      </aside>

      {isRolesOpen && <RolesDialog onClose={() => setIsRolesOpen(false)} />}
    </>
  );
}

function MemberRow({ member, isOnline }) {
  const {
    activeServer,
    roles,
    findRole,
    canAssignRole,
    can,
    updateMemberRole,
    removeMember,
  } = useServerStore();
  const { authUser } = useAuthStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const isOwner = activeServer.ownerId === member._id;
  const isSelf = member._id === authUser._id;
  const role = findRole(member.roleId);

  // the owner is untouchable, nobody manages themselves from here, and you
  // cannot touch someone who outranks you
  const canManage =
    can(PERMISSIONS.MANAGE_MEMBERS) &&
    !isOwner &&
    !isSelf &&
    (!role || canAssignRole(role));

  const handleRole = (roleId) => {
    setIsMenuOpen(false);
    if (roleId !== member.roleId) updateMemberRole(member._id, roleId);
  };

  const handleRemove = () => {
    setIsMenuOpen(false);
    const confirmed = window.confirm(
      `Remove ${member.fullName} from ${activeServer.name}?`,
    );
    if (confirmed) removeMember(member._id);
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-3 transition-colors group relative">
      <div className="relative flex-shrink-0">
        <img
          src={member.profilePic || "/avatar.png"}
          alt={member.fullName}
          className={`size-8 rounded-full object-cover ${isOnline ? "" : "opacity-50"}`}
        />
        {isOnline && (
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-green-500 border-2 border-surface-1" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-slate-200 text-sm truncate">{member.fullName}</p>
        <p className="text-slate-500 text-xs truncate">@{member.username}</p>
      </div>

      {isOwner ? (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand/20 text-brand-soft flex-shrink-0">
          Owner
        </span>
      ) : (
        role &&
        !role.isDefault && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0"
            style={{ backgroundColor: `${role.color}33`, color: role.color }}
          >
            {role.name}
          </span>
        )
      )}

      {canManage && (
        <div ref={menuRef} className="flex-shrink-0">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            title="Manage member"
            className="icon-btn opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreVerticalIcon className="size-4" />
          </button>

          {isMenuOpen && (
            <div className="absolute right-2 top-full z-20 panel p-1 w-48 shadow-xl shadow-black/50">
              <p className="field-label px-2 pt-1.5 mb-1">Assign role</p>

              {roles().map((option) => (
                <button
                  key={option._id}
                  type="button"
                  // you cannot hand out a role that outranks you
                  disabled={!canAssignRole(option)}
                  onClick={() => handleRole(option._id)}
                  className={`sidebar-item ${
                    member.roleId === option._id ? "text-brand-soft" : ""
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  <span
                    className="size-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: option.color }}
                  />
                  <span className="truncate flex-1">{option.name}</span>
                  {member.roleId === option._id && (
                    <span className="text-[10px]">current</span>
                  )}
                </button>
              ))}

              <span className="block h-px my-1 bg-edge" />

              <button
                type="button"
                onClick={handleRemove}
                className="sidebar-item text-red-400 hover:text-red-300"
              >
                <UserMinusIcon className="size-4" />
                Remove from server
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChannelDetailsPanel;
