import { MessageCircleIcon } from "lucide-react";

const NoChatHistoryPlaceholder = ({ name }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6">
      <div className="size-16 bg-gradient-to-br from-brand/20 to-brand/5 rounded-2xl flex items-center justify-center mb-5">
        <MessageCircleIcon className="size-8 text-brand-soft" />
      </div>
      <h3 className="text-lg font-medium text-slate-200 mb-3">
        Start your conversation with {name}
      </h3>
      <div className="flex flex-col space-y-3 max-w-md mb-5">
        <p className="text-slate-400 text-sm">
          This is the beginning of your conversation. Send a message to start
          chatting!
        </p>
        <div className="h-px w-32 bg-gradient-to-r from-transparent via-brand/40 to-transparent mx-auto"></div>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        <button className="px-4 py-2 text-xs font-medium text-brand-soft bg-brand/10 rounded-full hover:bg-brand/20 transition-colors cursor-pointer">
          👋 Say Hello
        </button>
        <button className="px-4 py-2 text-xs font-medium text-brand-soft bg-brand/10 rounded-full hover:bg-brand/20 transition-colors cursor-pointer">
          🤝 How are you?
        </button>
        <button className="px-4 py-2 text-xs font-medium text-brand-soft bg-brand/10 rounded-full hover:bg-brand/20 transition-colors cursor-pointer">
          📅 Meet up soon?
        </button>
      </div>
    </div>
  );
};

export default NoChatHistoryPlaceholder;
