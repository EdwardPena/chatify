import { useState } from "react";
import { HashIcon, LoaderIcon, Volume2Icon, XIcon } from "lucide-react";
import { CHANNEL_TYPES, useServerStore } from "../store/useServerStore";

const CHANNEL_KINDS = [
  {
    type: CHANNEL_TYPES.TEXT,
    label: "Text",
    hint: "Messages, images and voice notes",
    Icon: HashIcon,
  },
  {
    type: CHANNEL_TYPES.VOICE,
    label: "Voice",
    hint: "Talk live with everyone who joins",
    Icon: Volume2Icon,
  },
];

// admins only, the sidebar never renders the button that opens this
function CreateChannelModal({ defaultType = CHANNEL_TYPES.TEXT, onClose }) {
  const [type, setType] = useState(defaultType);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");

  const { createChannel, isCreatingChannel } = useServerStore();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const created = await createChannel({ name: name.trim(), type, topic });
    if (created) onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              Create a channel
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Channel names are lowercase and use dashes instead of spaces.
            </p>
          </div>

          <button type="button" onClick={onClose} className="icon-btn">
            <XIcon className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-5">
          <div>
            <label className="field-label">Channel type</label>

            <div className="space-y-2">
              {CHANNEL_KINDS.map(({ type: kind, label, hint, Icon }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setType(kind)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    type === kind
                      ? "bg-brand/10 border-brand"
                      : "bg-surface-1 border-edge hover:bg-surface-3"
                  }`}
                >
                  <Icon
                    className={`size-5 flex-shrink-0 ${
                      type === kind ? "text-brand-soft" : "text-slate-500"
                    }`}
                  />

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500">{hint}</p>
                  </div>

                  <span
                    className={`ml-auto size-4 rounded-full border flex-shrink-0 ${
                      type === kind
                        ? "border-brand bg-brand"
                        : "border-slate-600"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="field-label">Channel name</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                {type === CHANNEL_TYPES.TEXT ? (
                  <HashIcon className="size-4" />
                ) : (
                  <Volume2Icon className="size-4" />
                )}
              </span>

              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={30}
                placeholder="design-system"
                className="field-input pl-9"
              />
            </div>
          </div>

          {type === CHANNEL_TYPES.TEXT && (
            <div>
              <label className="field-label">Topic (optional)</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                maxLength={200}
                placeholder="Design specs, tokens and weekly review"
                className="field-input"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="ghost-btn">
              Cancel
            </button>

            <button
              type="submit"
              disabled={isCreatingChannel || !name.trim()}
              className="primary-btn min-w-32"
            >
              {isCreatingChannel ? (
                <LoaderIcon className="size-4 animate-spin mx-auto" />
              ) : (
                "Create channel"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateChannelModal;
