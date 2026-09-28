import { useEffect, useRef } from "react";

// the list that drops out of the @ button, filtered by whatever follows the @
function MentionPicker({ people, query, onPick, onClose }) {
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

  return (
    <div
      ref={boxRef}
      className="absolute bottom-full left-6 mb-1 z-30 panel p-1 w-64 max-h-60 overflow-y-auto scrollbar-thin shadow-xl shadow-black/50"
    >
      {people.length === 0 ? (
        <p className="text-slate-500 text-xs text-center py-4">
          {query ? `Nobody here matches "${query}".` : "Nobody to mention here."}
        </p>
      ) : (
        people.map((person, index) => (
          <button
            key={person._id}
            type="button"
            // clicking must not steal focus before the caret is used
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(person)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface-4 transition-colors cursor-pointer text-left ${
              index === 0 && query ? "bg-surface-4" : ""
            }`}
          >
            <img
              src={person.profilePic || "/avatar.png"}
              alt={person.fullName}
              className="size-6 rounded-full object-cover flex-shrink-0"
            />
            <span className="text-slate-200 text-xs truncate">
              {person.fullName}
            </span>
            <span className="text-slate-500 text-[10px] truncate ml-auto">
              @{person.username}
            </span>
          </button>
        ))
      )}
    </div>
  );
}

export default MentionPicker;
