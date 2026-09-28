import { CornerUpLeftIcon, XIcon } from "lucide-react";

// the strip above the composer while you are answering something
function ReplyPreview({ message, authorName, onCancel }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-3">
      <CornerUpLeftIcon className="size-4 text-brand-soft flex-shrink-0" />

      <div className="min-w-0 flex-1 border-l-2 border-brand pl-3">
        <p className="text-brand-soft text-xs font-medium truncate">
          Replying to {authorName}
        </p>
        <p className="text-slate-400 text-xs truncate">
          {message.text || (message.image ? "Photo" : "Voice message")}
        </p>
      </div>

      <button
        type="button"
        onClick={onCancel}
        title="Cancel reply"
        className="icon-btn flex-shrink-0"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );
}

// the quoted block shown inside a message that answers another one
export function QuotedMessage({ message, authorName, isMine }) {
  return (
    <div
      className={`mb-1 pl-2 border-l-2 ${
        isMine ? "border-white/40" : "border-brand"
      }`}
    >
      <p
        className={`text-[11px] font-medium truncate ${
          isMine ? "text-white/80" : "text-brand-soft"
        }`}
      >
        {authorName}
      </p>
      <p
        className={`text-xs truncate ${
          isMine ? "text-white/70" : "text-slate-400"
        }`}
      >
        {message.text || (message.image ? "Photo" : "Voice message")}
      </p>
    </div>
  );
}

export default ReplyPreview;
