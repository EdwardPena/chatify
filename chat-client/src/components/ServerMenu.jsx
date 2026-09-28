import { useEffect, useRef, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  LogOutIcon,
  PlusIcon,
  RefreshCwIcon,
  ShieldIcon,
  Trash2Icon,
} from "lucide-react";
import toast from "react-hot-toast";
import { PERMISSIONS, useServerStore } from "../store/useServerStore";
import { useAuthStore } from "../store/useAuthStore";
import CreateChannelModal from "./CreateChannelModal";
import RolesDialog from "./RolesDialog";

// everything you can do to a server hangs off its name in the sidebar
function ServerMenu() {
  const {
    activeServer,
    can,
    resetInviteCode,
    leaveServer,
    deleteServer,
  } = useServerStore();
  const { authUser } = useAuthStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [isRolesOpen, setIsRolesOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const isOwner = activeServer.ownerId === authUser._id;
  const canManageChannels = can(PERMISSIONS.MANAGE_CHANNELS);
  const canManageServer = can(PERMISSIONS.MANAGE_SERVER);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeServer.inviteCode);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2000);
    } catch (error) {
      console.log("Clipboard write failed: ", error);
      toast.error("Could not copy the invite code");
    }
  };

  const handleLeave = () => {
    const confirmed = window.confirm(`Leave ${activeServer.name}?`);
    if (confirmed) leaveServer(activeServer._id);
  };

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Delete ${activeServer.name}? Every channel and message in it is gone for good.`,
    );
    if (confirmed) deleteServer(activeServer._id);
  };

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-3 transition-colors cursor-pointer"
        >
          <span className="text-slate-100 font-semibold truncate">
            {activeServer.name}
          </span>
          <ChevronDownIcon
            className={`size-4 text-slate-400 flex-shrink-0 transition-transform ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-20 panel p-2 shadow-xl shadow-black/50">
            <div className="px-2 py-1.5">
              <p className="field-label mb-1.5">Invite code</p>

              <div className="flex items-center gap-2">
                <code className="flex-1 bg-surface-1 border border-edge rounded-md px-2 py-1.5 text-xs font-mono tracking-widest text-brand-soft truncate">
                  {activeServer.inviteCode}
                </code>

                <button
                  type="button"
                  onClick={handleCopy}
                  title="Copy invite code"
                  className="icon-btn"
                >
                  {hasCopied ? (
                    <CheckIcon className="size-4 text-green-400" />
                  ) : (
                    <CopyIcon className="size-4" />
                  )}
                </button>
              </div>
            </div>

            <span className="block h-px my-2 bg-edge" />

            {canManageChannels && (
              <MenuItem
                icon={<PlusIcon className="size-4" />}
                label="Create channel"
                onClick={() => {
                  setIsOpen(false);
                  setIsCreateOpen(true);
                }}
              />
            )}

            <MenuItem
              icon={<ShieldIcon className="size-4" />}
              label="Roles and permissions"
              onClick={() => {
                setIsOpen(false);
                setIsRolesOpen(true);
              }}
            />

            {canManageServer && (
              <MenuItem
                icon={<RefreshCwIcon className="size-4" />}
                label="Reset invite code"
                // the menu stays open so the new code can be copied at once
                onClick={() => resetInviteCode(activeServer._id)}
              />
            )}

            {isOwner ? (
              <MenuItem
                icon={<Trash2Icon className="size-4" />}
                label="Delete server"
                isDanger
                onClick={() => {
                  setIsOpen(false);
                  handleDelete();
                }}
              />
            ) : (
              <MenuItem
                icon={<LogOutIcon className="size-4" />}
                label="Leave server"
                isDanger
                onClick={() => {
                  setIsOpen(false);
                  handleLeave();
                }}
              />
            )}
          </div>
        )}
      </div>

      {isCreateOpen && (
        <CreateChannelModal onClose={() => setIsCreateOpen(false)} />
      )}

      {isRolesOpen && <RolesDialog onClose={() => setIsRolesOpen(false)} />}
    </>
  );
}

function MenuItem({ icon, label, isDanger, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`sidebar-item ${
        isDanger ? "text-red-400 hover:text-red-300" : ""
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

export default ServerMenu;
