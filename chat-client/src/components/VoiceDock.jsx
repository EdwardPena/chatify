import { useEffect, useRef } from "react";
import { LoaderIcon, PhoneOffIcon, SignalIcon } from "lucide-react";
import { useVoiceStore } from "../store/useVoiceStore";

// the strip above the user card that shows you are in a call, plus the hidden
// <audio> elements that actually play everyone else
function VoiceDock() {
  const {
    activeVoiceChannel,
    remoteStreams,
    isConnecting,
    leaveVoiceChannel,
  } = useVoiceStore();

  if (!activeVoiceChannel && !isConnecting) return null;

  const listeners = Object.keys(remoteStreams).length;

  return (
    <div className="mx-2 mb-1 bg-green-500/10 border border-green-500/20 rounded-lg p-2.5">
      <div className="flex items-center gap-2">
        {isConnecting ? (
          <LoaderIcon className="size-4 text-green-400 animate-spin flex-shrink-0" />
        ) : (
          <SignalIcon className="size-4 text-green-400 flex-shrink-0" />
        )}

        <div className="min-w-0 flex-1">
          <p className="text-green-400 text-xs font-medium truncate">
            {isConnecting ? "Connecting..." : "Voice connected"}
          </p>
          <p className="text-slate-400 text-[11px] truncate">
            {activeVoiceChannel?.name}
            {listeners > 0 && ` · ${listeners + 1} in voice`}
          </p>
        </div>

        <button
          type="button"
          onClick={leaveVoiceChannel}
          title="Disconnect"
          className="text-slate-400 hover:text-red-400 transition-colors cursor-pointer flex-shrink-0"
        >
          <PhoneOffIcon className="size-4" />
        </button>
      </div>

      {Object.entries(remoteStreams).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} />
      ))}
    </div>
  );
}

// srcObject cannot be set through jsx, it has to go through the element
function RemoteAudio({ stream }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || audio.srcObject === stream) return;

    audio.srcObject = stream;
    audio.play().catch((e) => console.log("Audio play failed: ", e));
  }, [stream]);

  return <audio ref={audioRef} autoPlay playsInline className="hidden" />;
}

export default VoiceDock;
