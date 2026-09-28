import { useEffect, useRef, useState } from "react";
import { LoaderIcon, SearchIcon, XIcon } from "lucide-react";

const formatWhen = (date) =>
  new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// splits the text around the match so the hit can be highlighted in place
const highlight = (text, term) => {
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at === -1) return [text];

  return [
    text.slice(0, at),
    <mark key="hit" className="bg-brand/30 text-slate-100 rounded px-0.5">
      {text.slice(at, at + term.length)}
    </mark>,
    text.slice(at + term.length),
  ];
};

// the right rail in search mode, shared by channels and direct messages
function SearchPanel({ title, onSearch, onSelect, onClose, resolveSender }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  // the term the newest request was made for, so a slow answer to an older
  // query cannot overwrite a newer one
  const latestTermRef = useRef("");

  useEffect(() => {
    inputRef.current?.focus();
    return () => clearTimeout(timerRef.current);
  }, []);

  // debounced here rather than in an effect, so one query goes out per pause
  // in typing instead of one per keystroke
  const handleTermChange = (value) => {
    setTerm(value);
    clearTimeout(timerRef.current);

    const trimmed = value.trim();
    latestTermRef.current = trimmed;

    if (!trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    timerRef.current = setTimeout(async () => {
      const hits = await onSearch(trimmed);
      if (latestTermRef.current !== trimmed) return;

      setResults(hits);
      setIsSearching(false);
    }, 300);
  };

  return (
    <aside className="w-80 bg-surface-1 border-l border-edge flex flex-col flex-shrink-0">
      <header className="h-16 px-5 flex items-center justify-between border-b border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <SearchIcon className="size-4 text-slate-400 flex-shrink-0" />
          <h2 className="text-slate-100 font-semibold text-sm truncate">
            {title}
          </h2>
        </div>

        <button type="button" onClick={onClose} className="icon-btn">
          <XIcon className="size-4" />
        </button>
      </header>

      <div className="p-3 border-b border-edge">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 size-3.5" />
          <input
            ref={inputRef}
            type="text"
            value={term}
            onChange={(e) => handleTermChange(e.target.value)}
            placeholder="Search messages..."
            className="w-full bg-surface-0 border border-edge rounded-lg py-2 pl-9 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand focus:border-transparent focus:outline-none"
          />
          {term && (
            <button
              type="button"
              onClick={() => handleTermChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 icon-btn"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        {isSearching ? (
          <div className="flex justify-center py-6">
            <LoaderIcon className="size-5 animate-spin text-slate-500" />
          </div>
        ) : !term.trim() ? (
          <p className="text-slate-500 text-xs text-center py-6 px-2">
            Type to search every message in this conversation.
          </p>
        ) : results.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-6 px-2">
            No messages match “{term}”.
          </p>
        ) : (
          results.map((message) => {
            const sender = resolveSender(message);

            return (
              <button
                key={message._id}
                type="button"
                onClick={() => onSelect(message)}
                className="w-full text-left panel p-3 hover:bg-surface-4 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <img
                    src={sender.profilePic || "/avatar.png"}
                    alt={sender.fullName}
                    className="size-5 rounded-full object-cover"
                  />
                  <span className="text-slate-200 text-xs font-medium truncate">
                    {sender.fullName}
                  </span>
                  <span className="text-slate-600 text-[10px] ml-auto flex-shrink-0">
                    {formatWhen(message.createdAt)}
                  </span>
                </div>

                <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                  {message.text ? highlight(message.text, term) : "Attachment"}
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}

export default SearchPanel;
