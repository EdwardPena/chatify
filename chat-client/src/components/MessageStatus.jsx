import { CheckCheckIcon, CheckIcon } from "lucide-react";

// one tick once it left, two once it arrived, two in colour once it was read
function MessageStatus({ status }) {
  if (status === "read") {
    return (
      <CheckCheckIcon className="size-3.5 text-sky-300" title="Read" />
    );
  }

  if (status === "delivered") {
    return (
      <CheckCheckIcon className="size-3.5 opacity-70" title="Delivered" />
    );
  }

  return <CheckIcon className="size-3.5 opacity-70" title="Sent" />;
}

export default MessageStatus;
