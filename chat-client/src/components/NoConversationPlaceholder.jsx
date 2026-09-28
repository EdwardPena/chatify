import { MessageCircleIcon } from "lucide-react";

const NoConversationPlaceholder = () => {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-center p-6">
      <div className="size-20 bg-brand/15 rounded-2xl flex items-center justify-center mb-6">
        <MessageCircleIcon className="size-10 text-brand-soft" />
      </div>
      <h3 className="text-xl font-semibold text-slate-200 mb-2">
        Select a conversation
      </h3>
      <p className="text-slate-400 max-w-md text-sm">
        Choose a contact from the sidebar to start chatting, or open a server on
        the left to join its channels.
      </p>
    </div>
  );
};

export default NoConversationPlaceholder;
