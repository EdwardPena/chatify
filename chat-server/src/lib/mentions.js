import User from "../models/User.js";

// usernames are lowercase, 3 to 20 characters, letters digits and underscores
const MENTION_PATTERN = /@([a-z0-9_]{3,20})/gi;

// turns the handles typed into a message into real user ids, keeping only
// people who are actually allowed to be tagged there: a server's members, or
// the other half of a direct conversation
export const resolveMentions = async (text, allowedUserIds) => {
  if (!text) return [];

  const handles = [
    ...new Set([...text.matchAll(MENTION_PATTERN)].map((m) => m[1].toLowerCase())),
  ];
  if (handles.length === 0) return [];

  const users = await User.find({
    username: { $in: handles },
    _id: { $in: allowedUserIds },
  }).select("_id");

  return users.map((user) => user._id);
};

// the client needs the handle back to colour it in the message
export const MENTION_FIELDS = "username fullName";
