import { useRef, useState } from "react";
import { ImagePlusIcon, LoaderIcon, XIcon } from "lucide-react";
import { useServerStore } from "../store/useServerStore";

// one dialog, two doors: start something new or walk into someone else's
function CreateServerModal({ onClose }) {
  const [mode, setMode] = useState("create");
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(null);
  const [inviteCode, setInviteCode] = useState("");

  const fileInputRef = useRef(null);
  const { createServer, joinServer, isCreatingServer } = useServerStore();

  const handleIconChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => setIcon(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const created =
      mode === "create"
        ? await createServer({ name: name.trim(), icon })
        : await joinServer(inviteCode.trim());

    if (created) onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {mode === "create" ? "Create a server" : "Join a server"}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {mode === "create"
                ? "Your server starts with a text channel and a voice channel."
                : "Paste the invite code an admin shared with you."}
            </p>
          </div>

          <button type="button" onClick={onClose} className="icon-btn">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="px-6">
          <div className="flex gap-1 p-1 bg-surface-1 rounded-lg">
            {["create", "join"].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={`flex-1 py-1.5 rounded-md text-sm font-medium capitalize transition-colors cursor-pointer ${
                  mode === option
                    ? "bg-brand text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {mode === "create" ? (
            <>
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="size-20 rounded-full bg-surface-1 border border-dashed border-edge flex items-center justify-center overflow-hidden text-slate-500 hover:text-brand-soft hover:border-brand transition-colors cursor-pointer"
                >
                  {icon ? (
                    <img src={icon} alt="Server icon" className="size-full object-cover" />
                  ) : (
                    <ImagePlusIcon className="size-6" />
                  )}
                </button>

                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleIconChange}
                  className="hidden"
                />
              </div>

              <div>
                <label className="field-label">Server name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder="Pulse HQ"
                  className="field-input"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="field-label">Invite code</label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="a1b2c3d4"
                className="field-input font-mono tracking-widest"
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="ghost-btn">
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                isCreatingServer ||
                (mode === "create" ? !name.trim() : !inviteCode.trim())
              }
              className="primary-btn min-w-28"
            >
              {isCreatingServer ? (
                <LoaderIcon className="size-4 animate-spin mx-auto" />
              ) : mode === "create" ? (
                "Create server"
              ) : (
                "Join server"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateServerModal;
