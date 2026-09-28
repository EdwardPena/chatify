import { HashIcon, PlusIcon } from "lucide-react";
import {
  CHANNEL_TYPES,
  PERMISSIONS,
  useServerStore,
} from "../store/useServerStore";
import CreateChannelModal from "./CreateChannelModal";
import { useState } from "react";

// a server with no text channel left, which only an admin can fix
function NoChannelPlaceholder() {
  const { activeServer, can } = useServerStore();
  const canManage = can(PERMISSIONS.MANAGE_CHANNELS);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  return (
    <>
      <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-surface-2">
        <div className="size-20 bg-brand/15 rounded-2xl flex items-center justify-center mb-6">
          <HashIcon className="size-10 text-brand-soft" />
        </div>

        <h3 className="text-xl font-semibold text-slate-200 mb-2">
          No channel open
        </h3>
        <p className="text-slate-400 max-w-md text-sm">
          {canManage
            ? `${activeServer.name} has no text channel yet. Create one to start the conversation.`
            : `${activeServer.name} has no text channel yet. An admin needs to create one.`}
        </p>

        {canManage && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="primary-btn mt-6 inline-flex items-center gap-2"
          >
            <PlusIcon className="size-4" />
            Create a channel
          </button>
        )}
      </div>

      {isCreateOpen && (
        <CreateChannelModal
          defaultType={CHANNEL_TYPES.TEXT}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </>
  );
}

export default NoChannelPlaceholder;
