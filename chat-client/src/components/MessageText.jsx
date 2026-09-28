// mentions travel with the message, so rendering only has to find the handles
// again and colour the ones that resolved to a real person
const HANDLE = /(@[a-z0-9_]{3,20})/gi;

function MessageText({ text, mentions = [], meId }) {
  if (!text) return null;
  if (mentions.length === 0) return text;

  const known = new Map(
    mentions.map((user) => [user.username.toLowerCase(), user]),
  );

  return text.split(HANDLE).map((part, index) => {
    if (!part.startsWith("@")) return part;

    const user = known.get(part.slice(1).toLowerCase());
    // an @something that matched nobody stays plain text
    if (!user) return part;

    const isMe = user._id === meId;
    return (
      <span
        key={index}
        title={user.fullName}
        className={`rounded px-1 py-0.5 font-medium ${
          isMe
            ? "bg-amber-400/20 text-amber-300"
            : "bg-brand/20 text-brand-soft"
        }`}
      >
        {part}
      </span>
    );
  });
}

export default MessageText;
