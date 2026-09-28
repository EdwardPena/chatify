import { useEffect, useState } from "react";
import { HelpCircleIcon, PlusIcon, ZapIcon } from "lucide-react";
import { useServerStore } from "../store/useServerStore";
import CreateServerModal from "./CreateServerModal";
import HelpDialog from "./HelpDialog";

// the two letters we show when a server has no icon of its own
const getInitials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

function ServerRail() {
  const { servers, activeServer, getMyServers, selectServer, serverBadge } =
    useServerStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  useEffect(() => {
    getMyServers();
  }, [getMyServers]);

  return (
    <>
      <nav className="w-18 bg-surface-0 flex flex-col items-center gap-2 py-3 flex-shrink-0">
        {/* DIRECT MESSAGES, the home of the app */}
        <RailButton
          label="Direct messages"
          isActive={!activeServer}
          onClick={() => selectServer(null)}
        >
          <ZapIcon className="size-5" />
        </RailButton>

        <span className="h-px w-8 bg-edge" />

        <div className="flex-1 w-full flex flex-col items-center gap-2 overflow-y-auto scrollbar-thin">
          {servers.map((server) => (
            <RailButton
              key={server._id}
              label={server.name}
              isActive={activeServer?._id === server._id}
              badge={serverBadge(server._id)}
              onClick={() => selectServer(server._id)}
            >
              {server.icon ? (
                <img
                  src={server.icon}
                  alt={server.name}
                  className="size-full object-cover"
                />
              ) : (
                <span className="text-sm font-semibold">
                  {getInitials(server.name)}
                </span>
              )}
            </RailButton>
          ))}

          <RailButton
            label="Create or join a server"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusIcon className="size-5" />
          </RailButton>
        </div>

        <button
          type="button"
          onClick={() => setIsHelpOpen(true)}
          className="icon-btn p-2"
          title="How this works"
        >
          <HelpCircleIcon className="size-5" />
        </button>
      </nav>

      {isCreateOpen && (
        <CreateServerModal onClose={() => setIsCreateOpen(false)} />
      )}

      {isHelpOpen && <HelpDialog onClose={() => setIsHelpOpen(false)} />}
    </>
  );
}

// the white pill on the left edge is how the rail marks where you are
function RailButton({ label, isActive, badge, onClick, children }) {
  return (
    <div className="relative w-full flex justify-center group">
      <span
        className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-white transition-all ${
          isActive ? "h-8" : badge?.count ? "h-4" : "h-0 group-hover:h-4"
        }`}
      />

      <button
        type="button"
        onClick={onClick}
        title={label}
        className={`rail-btn ${isActive ? "rail-btn-active" : ""}`}
      >
        {children}
      </button>

      {/* what is waiting inside, summed across the server's channels */}
      {badge?.count > 0 && (
        <span
          title={`${badge.count} unread`}
          className={`absolute -top-0.5 right-2 min-w-4.5 h-4.5 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center border-2 border-surface-0 ${
            badge.isMention
              ? "bg-amber-400 text-slate-900"
              : "bg-brand text-white"
          }`}
        >
          {badge.count > 9 ? "9+" : badge.count}
        </span>
      )}
    </div>
  );
}

export default ServerRail;
