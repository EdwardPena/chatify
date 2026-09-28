import { useEffect, useMemo, useRef, useState } from "react";
import {
  ClockIcon,
  FlagIcon,
  HashIcon,
  LeafIcon,
  LightbulbIcon,
  PizzaIcon,
  PlaneIcon,
  SearchIcon,
  SmileIcon,
  TrophyIcon,
  UserIcon,
} from "lucide-react";
import {
  getSupportedEmoji,
  readRecentEmoji,
  rememberEmoji,
} from "../lib/emojiSupport";

const RECENT_TAB = "Recent";

// nine categories plus recents do not fit across the picker as words, so each
// one is a glyph with its name on the tooltip
const TAB_ICONS = {
  [RECENT_TAB]: ClockIcon,
  Smileys: SmileIcon,
  People: UserIcon,
  Nature: LeafIcon,
  Food: PizzaIcon,
  Travel: PlaneIcon,
  Activities: TrophyIcon,
  Objects: LightbulbIcon,
  Symbols: HashIcon,
  Flags: FlagIcon,
};

function EmojiPicker({ onPick, onClose }) {
  // whatever this machine can draw, worked out once and kept
  const groups = useMemo(() => getSupportedEmoji(), []);
  const [recent, setRecent] = useState(readRecentEmoji);
  const [tab, setTab] = useState(recent.length > 0 ? RECENT_TAB : groups[0]?.name);
  const [query, setQuery] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!boxRef.current?.contains(event.target)) onClose();
    };
    const handleEsc = (event) => event.key === "Escape" && onClose();

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  // searching looks across every group, browsing shows one at a time
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle) {
      return groups
        .flatMap((group) => group.emojis)
        .filter(([, name]) => name.includes(needle))
        .slice(0, 180);
    }

    if (tab === RECENT_TAB) return recent.map((glyph) => [glyph, glyph]);
    return groups.find((group) => group.name === tab)?.emojis || [];
  }, [groups, tab, query, recent]);

  const handlePick = (glyph) => {
    setRecent(rememberEmoji(glyph));
    onPick(glyph);
  };

  const tabs = recent.length > 0 ? [RECENT_TAB, ...groups.map((g) => g.name)] : groups.map((g) => g.name);

  return (
    <div
      ref={boxRef}
      className="absolute bottom-full left-6 mb-1 z-30 panel w-80 shadow-xl shadow-black/50 flex flex-col"
    >
      <div className="p-2 pb-0">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 size-3.5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emoji..."
            className="w-full bg-surface-1 border border-edge rounded-lg py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-brand focus:border-transparent focus:outline-none"
          />
        </div>
      </div>

      {!query.trim() && (
        <div className="flex items-center gap-0.5 px-2 pt-2 pb-2 border-b border-edge">
          {tabs.map((name) => {
            const Icon = TAB_ICONS[name] || SmileIcon;

            return (
              <button
                key={name}
                type="button"
                title={name}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setTab(name)}
                className={`flex-1 flex items-center justify-center py-1.5 rounded-md transition-colors cursor-pointer ${
                  tab === name
                    ? "bg-brand text-white"
                    : "text-slate-500 hover:text-slate-200 hover:bg-surface-4"
                }`}
              >
                <Icon className="size-3.5" />
              </button>
            );
          })}
        </div>
      )}

      {!query.trim() && (
        <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {tab}
        </p>
      )}

      <div className="grid grid-cols-8 gap-0.5 p-2 max-h-56 overflow-y-auto scrollbar-thin">
        {shown.length === 0 ? (
          <p className="col-span-8 text-slate-500 text-xs text-center py-6">
            Nothing matches “{query.trim()}”.
          </p>
        ) : (
          shown.map(([glyph, name]) => (
            <button
              key={glyph}
              type="button"
              title={name}
              // keep the caret where it is while the click lands
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(glyph)}
              className="size-8 rounded-md text-xl leading-none hover:bg-surface-4 transition-colors cursor-pointer"
            >
              {glyph}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default EmojiPicker;
