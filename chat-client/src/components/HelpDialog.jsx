import { XIcon } from "lucide-react";

const SHORTCUTS = [
  ["Escape", "Close the open conversation or dialog"],
  ["Click a voice channel", "Join it, click the dock to hang up"],
  ["Hover a message", "Delete it, if it is yours or you moderate"],
  ["@", "Mention someone in this conversation"],
];

const BASICS = [
  ["Servers", "The rail on the far left. Use + to create one or join with an invite code."],
  ["Channels", "Text channels hold messages, voice channels hold conversations."],
  ["Roles", "Owners and admins assign roles from the members list on the right."],
  ["Contacts", "Direct messages only work between people who accepted each other."],
];

function HelpDialog({ onClose }) {
  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog-card max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-6 pb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              How this works
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              The short version of everything in the app.
            </p>
          </div>

          <button type="button" onClick={onClose} className="icon-btn">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <section>
            <h3 className="field-label">The basics</h3>
            <dl className="space-y-2">
              {BASICS.map(([term, detail]) => (
                <div key={term}>
                  <dt className="text-slate-200 text-sm font-medium">{term}</dt>
                  <dd className="text-slate-400 text-xs">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section>
            <h3 className="field-label">Shortcuts</h3>
            <dl className="space-y-1.5">
              {SHORTCUTS.map(([key, detail]) => (
                <div key={key} className="flex items-baseline gap-3">
                  <dt className="flex-shrink-0">
                    <kbd className="px-1.5 py-0.5 rounded bg-surface-1 border border-edge text-[10px] text-slate-300">
                      {key}
                    </kbd>
                  </dt>
                  <dd className="text-slate-400 text-xs">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

export default HelpDialog;
