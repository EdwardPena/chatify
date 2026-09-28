import { useEffect, useRef } from "react";
import {
  MicIcon,
  MicOffIcon,
  PhoneIcon,
  PhoneOffIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import { useCallStore } from "../store/useCallStore";

// a media element cannot take a stream through jsx, it has to be assigned
function StreamVideo({ stream, muted, className }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.srcObject === stream) return;

    el.srcObject = stream || null;
    if (stream) el.play().catch((e) => console.log("Playback failed: ", e));
  }, [stream]);

  return (
    <video ref={ref} autoPlay playsInline muted={muted} className={className} />
  );
}

function CallOverlay() {
  const {
    activeCall,
    localStream,
    remoteStream,
    isMuted,
    isCameraOn,
    toggleMute,
    toggleCamera,
    endCall,
  } = useCallStore();

  if (!activeCall) return null;

  const { user, isConnected } = activeCall;
  const showVideo = isCameraOn || remoteStream?.getVideoTracks().length > 0;

  return (
    <div className="fixed inset-0 z-50 bg-surface-0/95 backdrop-blur-sm flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl flex flex-col items-center">
        {showVideo ? (
          <div className="relative w-full aspect-video bg-surface-1 rounded-2xl overflow-hidden border border-edge">
            <StreamVideo
              stream={remoteStream}
              className="size-full object-cover"
            />

            {/* our own camera, small, in the corner, and always silent */}
            {isCameraOn && (
              <div className="absolute bottom-4 right-4 w-48 aspect-video rounded-xl overflow-hidden border border-edge shadow-lg">
                <StreamVideo
                  stream={localStream}
                  muted
                  className="size-full object-cover"
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <img
              src={user.profilePic || "/avatar.png"}
              alt={user.fullName}
              className={`size-28 rounded-full object-cover ${
                isConnected ? "" : "animate-pulse"
              }`}
            />
            {/* the remote audio still has to be in the document to play */}
            <StreamVideo stream={remoteStream} className="hidden" />
          </div>
        )}

        <h2 className="text-slate-100 text-xl font-semibold mt-6">
          {user.fullName}
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          {isConnected ? "Connected" : "Ringing..."}
        </p>

        <div className="flex items-center gap-3 mt-8">
          <button
            type="button"
            onClick={toggleMute}
            title={isMuted ? "Unmute" : "Mute"}
            className={`size-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isMuted
                ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                : "bg-surface-3 text-slate-300 hover:bg-surface-4"
            }`}
          >
            {isMuted ? (
              <MicOffIcon className="size-5" />
            ) : (
              <MicIcon className="size-5" />
            )}
          </button>

          <button
            type="button"
            onClick={toggleCamera}
            title={isCameraOn ? "Turn camera off" : "Turn camera on"}
            className={`size-12 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isCameraOn
                ? "bg-brand/20 text-brand-soft hover:bg-brand/30"
                : "bg-surface-3 text-slate-300 hover:bg-surface-4"
            }`}
          >
            {isCameraOn ? (
              <VideoIcon className="size-5" />
            ) : (
              <VideoOffIcon className="size-5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => endCall()}
            title="Hang up"
            className="size-12 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
          >
            <PhoneOffIcon className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// the ringing card the person on the other end sees
export function IncomingCallModal() {
  const { incomingCall, acceptCall, declineCall } = useCallStore();

  if (!incomingCall) return null;

  const { from, withVideo } = incomingCall;

  return (
    <div className="fixed bottom-6 right-6 z-50 panel p-4 w-80 shadow-2xl shadow-black/60">
      <div className="flex items-center gap-3">
        <img
          src={from.profilePic || "/avatar.png"}
          alt={from.fullName}
          className="size-12 rounded-full object-cover animate-pulse"
        />

        <div className="min-w-0 flex-1">
          <p className="text-slate-100 font-medium truncate">{from.fullName}</p>
          <p className="text-slate-400 text-xs">
            Incoming {withVideo ? "video call" : "call"}
          </p>
        </div>
      </div>

      <div className="flex gap-2 mt-4">
        <button
          type="button"
          onClick={declineCall}
          className="flex-1 py-2 rounded-lg bg-surface-4 text-slate-300 text-sm font-medium hover:bg-red-500/20 hover:text-red-400 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <PhoneOffIcon className="size-4" />
          Decline
        </button>

        <button
          type="button"
          onClick={acceptCall}
          className="flex-1 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition-colors cursor-pointer inline-flex items-center justify-center gap-2"
        >
          <PhoneIcon className="size-4" />
          Accept
        </button>
      </div>
    </div>
  );
}

export default CallOverlay;
