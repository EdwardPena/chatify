import { useState } from "react";
import { LoaderIcon, SearchIcon, UserPlusIcon, XIcon } from "lucide-react";
import { useContactStore } from "../store/useContactStore";

// what to show instead of the add button once a relationship exists
const RELATIONSHIP_LABELS = {
  accepted: "Contact",
  outgoing_pending: "Pending",
  incoming_pending: "Asked you",
};

function AddContact() {
  const [query, setQuery] = useState("");
  const {
    searchUsers,
    clearSearch,
    searchResults,
    isSearching,
    sendContactRequest,
    isSendingRequest,
  } = useContactStore();

  const handleSearch = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    searchUsers(query);
  };

  const handleClear = () => {
    setQuery("");
    clearSearch();
  };

  return (
    <div className="space-y-2">
      <form onSubmit={handleSearch} className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add by username..."
          className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 pl-9 pr-9 text-sm text-slate-200 placeholder-slate-400 focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
          >
            <XIcon className="size-4" />
          </button>
        )}
      </form>

      {isSearching && (
        <div className="flex justify-center py-3">
          <LoaderIcon className="size-5 animate-spin text-slate-400" />
        </div>
      )}

      {!isSearching && searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((user) => {
            const label = RELATIONSHIP_LABELS[user.relationship.status];

            return (
              <div
                key={user._id}
                className="bg-slate-800/50 p-3 rounded-lg flex items-center gap-3"
              >
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.fullName}
                  className="size-9 rounded-full object-cover"
                />

                <div className="min-w-0 flex-1">
                  <h4 className="text-slate-200 text-sm font-medium truncate">
                    {user.fullName}
                  </h4>
                  <p className="text-slate-400 text-xs truncate">
                    @{user.username}
                  </p>
                </div>

                {label ? (
                  <span className="text-xs text-slate-400 flex-shrink-0">
                    {label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => sendContactRequest(user.username)}
                    disabled={isSendingRequest}
                    title="Send contact request"
                    className="text-cyan-400 hover:text-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer flex-shrink-0"
                  >
                    <UserPlusIcon className="size-5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default AddContact;
