import {
  CallOverlay,
  ChannelContainer,
  ChatContainer,
  IncomingCallModal,
  NoChannelPlaceholder,
  NoConversationPlaceholder,
  ServerRail,
  VoiceChannelStage,
  WorkspaceSidebar,
} from "../components";
import { LoaderIcon } from "lucide-react";
import { useChatStore } from "../store/useChatStore";
import { CHANNEL_TYPES, useServerStore } from "../store/useServerStore";

function ChatPage() {
  const { selectedUser } = useChatStore();
  const { activeServer, activeChannel, isServerLoading } = useServerStore();

  // a server that is still loading has no channel yet, which is not the same
  // as a server with no channels at all
  const mainPane = activeServer ? (
    isServerLoading ? (
      <div className="flex-1 flex items-center justify-center bg-surface-2">
        <LoaderIcon className="size-6 animate-spin text-slate-600" />
      </div>
    ) : activeChannel ? (
      activeChannel.type === CHANNEL_TYPES.VOICE ? (
        <VoiceChannelStage />
      ) : (
        <ChannelContainer />
      )
    ) : (
      <NoChannelPlaceholder />
    )
  ) : (
    <main className="flex-1 flex min-w-0 bg-surface-2">
      {selectedUser ? <ChatContainer /> : <NoConversationPlaceholder />}
    </main>
  );

  return (
    <div className="h-screen w-full flex bg-surface-0 overflow-hidden">
      <ServerRail />
      <WorkspaceSidebar />
      {mainPane}

      <CallOverlay />
      <IncomingCallModal />
    </div>
  );
}
export default ChatPage;
