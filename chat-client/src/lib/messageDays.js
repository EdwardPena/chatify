// midnight of whatever day this timestamp falls on, which is what makes two
// messages belong to the same section
const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const DAY = 24 * 60 * 60 * 1000;

// "Today" and "Yesterday" while they still mean something, the date itself
// once they stop
export const dayLabel = (value) => {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(value)) / DAY);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";

  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: sameYear ? undefined : "numeric",
  });
};

// splits a conversation into one section per day, so the date is written once
// at the top of each run instead of on every message
export const groupByDay = (messages) =>
  messages.reduce((sections, message) => {
    const day = startOfDay(message.createdAt).getTime();
    const current = sections.at(-1);

    if (current?.day === day) current.messages.push(message);
    else sections.push({ day, label: dayLabel(message.createdAt), messages: [message] });

    return sections;
  }, []);
