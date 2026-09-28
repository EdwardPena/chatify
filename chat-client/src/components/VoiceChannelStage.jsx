import { useEffect, useRef } from "react";
import {
  MicIcon,
  MicOffIcon,
  MonitorUpIcon,
  MonitorXIcon,
  PhoneIcon,
  PhoneOffIcon,
  ScreenShareIcon,
  VideoIcon,
  VideoOffIcon,
  Volume2Icon,
} from "lucide-react";
import { useServerStore } from "../store/useServerStore";
import { useVoiceStore } from "../store/useVoiceStore";
import { useAuthStore } from "../store/useAuthStore";

// a media element cannot take a stream through jsx, it has to be assigned
function StreamTile({ stream, muted, mirrored }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.srcObject === stream) return;

    el.srcObject = stream || null;
    if (stream) el.play().catch((e) => console.log("Playback failed: ", e));
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={`size-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
    />
  );
}

// the main pane while you are looking at a voice channel: who is in the call,
// what they are sharing, and the controls for your own microphone and camera
function VoiceChannelStage() {
  const { activeServer, activeChannel } = useServerStore();
  const {
    activeVoiceChannel,
    remoteStreams,
    streamVersion,
    isMuted,
    isCameraOn,
    isSharingScreen,
    isConnecting,
    toggleMute,
    toggleCamera,
    toggleScreenShare,
    joinVoiceChannel,
    leaveVoiceChannel,
    getLocalVideoStream,
  } = useVoiceStore();
  const { authUser } = useAuthStore();

  const isConnected = activeVoiceChannel?._id === activeChannel._id;
  // the participant list is live state from the server, it arrives for
  // everyone in the server whether or not they are in the call themselves
  const channel =
    activeServer.channels.find((c) => c._id === activeChannel._id) ||
    activeChannel;
  const participants = channel.participants || [];

  const localVideo = isConnected ? getLocalVideoStream() : null;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-surface-2">
      <header className="h-16 px-5 flex items-center gap-3 border-b border-edge flex-shrink-0">
        <div className="size-8 rounded-lg bg-brand/15 flex items-center justify-center flex-shrink-0">
          <Volume2Icon className="size-4 text-brand-soft" />
        </div>

        <div className="min-w-0">
          <h1 className="text-slate-100 font-semibold truncate">
            {activeChannel.name}
          </h1>
          <p className="text-slate-500 text-xs truncate">
            {participants.length === 0
              ? "Nobody is here yet"
              : `${participants.length} in the call`}
          </p>
        </div>

        {isConnected && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-green-400">
            <span className="size-1.5 rounded-full bg-green-400 animate-pulse" />
            Connected
          </span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        {participants.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="size-20 bg-brand/15 rounded-2xl flex items-center justify-center mb-6">
              <Volume2Icon className="size-10 text-brand-soft" />
            </div>
            <h3 className="text-xl font-semibold text-slate-200 mb-2">
              {activeChannel.name} is empty
            </h3>
            <p className="text-slate-400 max-w-md text-sm">
              Join the call and anyone else in {activeServer.name} can drop in.
            </p>
          </div>
        ) : (
          <div className="min-h-full flex items-center justify-center">
            {/* one tile should not balloon across the whole pane, so the grid
                only grows as people arrive */}
            <div
              className={`grid gap-4 grid-cols-[repeat(auto-fit,minmax(240px,1fr))] w-full ${
                participants.length === 1
                  ? "max-w-md"
                  : participants.length === 2
                    ? "max-w-3xl"
                    : "max-w-6xl"
              }`}
            >
              {participants.map((person) => {
                const isSelf = person._id === authUser._id;
                const stream = isSelf ? localVideo : remoteStreams[person._id];
                const hasVideo =
                  (isSelf && (isCameraOn || isSharingScreen)) ||
                  (!isSelf && (person.isCameraOn || person.isSharingScreen));

                return (
                  <div
                    key={`${person._id}-${streamVersion}`}
                    className="relative aspect-video rounded-xl overflow-hidden bg-surface-1 border border-edge flex items-center justify-center"
                  >
                    {hasVideo && stream ? (
                      <StreamTile
                        stream={stream}
                        muted={isSelf}
                        mirrored={isSelf && person.isCameraOn}
                      />
                    ) : (
                      <img
                        src={person.profilePic || "/avatar.png"}
                        alt={person.fullName}
                        className="size-20 rounded-full object-cover"
                      />
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-3 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent">
                      <span className="text-white text-sm font-medium truncate">
                        {person.fullName}
                        {isSelf && " (you)"}
                      </span>

                      {person.isSharingScreen && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-brand/30 text-brand-soft text-[10px] flex-shrink-0">
                          <ScreenShareIcon className="size-3" />
                          Sharing
                        </span>
                      )}

                      {person.isMuted && (
                        <MicOffIcon className="size-4 text-red-400 ml-auto flex-shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* the control bar, which only offers what you can actually do */}
      <div className="p-4 border-t border-edge flex items-center justify-center gap-3">
        {isConnected ? (
          <>
            <ControlButton
              onClick={toggleMute}
              active={isMuted}
              danger
              label={isMuted ? "Unmute" : "Mute"}
              Icon={isMuted ? MicOffIcon : MicIcon}
            />

            <ControlButton
              onClick={toggleCamera}
              active={isCameraOn}
              label={isCameraOn ? "Turn camera off" : "Turn camera on"}
              Icon={isCameraOn ? VideoIcon : VideoOffIcon}
            />

            <ControlButton
              onClick={toggleScreenShare}
              active={isSharingScreen}
              label={isSharingScreen ? "Stop sharing" : "Share your screen"}
              Icon={isSharingScreen ? MonitorXIcon : MonitorUpIcon}
            />

            <button
              type="button"
              onClick={leaveVoiceChannel}
              title="Disconnect"
              className="size-11 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors cursor-pointer"
            >
              <PhoneOffIcon className="size-5" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => joinVoiceChannel(activeChannel)}
            disabled={isConnecting}
            className="primary-btn inline-flex items-center gap-2 px-5"
          >
            <PhoneIcon className="size-4" />
            {isConnecting ? "Connecting..." : "Join the call"}
          </button>
        )}
      </div>
    </div>
  );
}

function ControlButton({ onClick, active, danger, label, Icon }) {
  const activeClass = danger
    ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
    : "bg-brand/20 text-brand-soft hover:bg-brand/30";

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`size-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
        active ? activeClass : "bg-surface-3 text-slate-300 hover:bg-surface-4"
      }`}
    >
      <Icon className="size-5" />
    </button>
  );
}

export default VoiceChannelStage;
