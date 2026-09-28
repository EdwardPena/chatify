import { useRef, useState } from "react";
import {
  LogOutIcon,
  MicIcon,
  MicOffIcon,
  Volume2Icon,
  VolumeOffIcon,
} from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useVoiceStore } from "../store/useVoiceStore";

const mouseClickSound = new Audio("/sounds/mouse-click.mp3");

// the card pinned to the bottom of the sidebar: who you are and the two
// switches you reach for most
function UserFooterCard() {
  const { logout, authUser, updateProfile } = useAuthStore();
  const { isSoundEnabled, toggleSound } = useChatStore();
  const { activeVoiceChannel, isMuted, toggleMute } = useVoiceStore();
  const [selectedImg, setSelectedImg] = useState(null);

  const fileInputRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onloadend = async () => {
      const base64Image = reader.result;
      setSelectedImg(base64Image);
      await updateProfile({ profilePic: base64Image });
    };
  };

  return (
    <div className="m-2 p-2 bg-surface-1 rounded-lg flex items-center gap-2">
      {/* AVATAR */}
      <div className="relative flex-shrink-0">
        <div className="size-9 rounded-full overflow-hidden relative group">
          <button
            className="size-full cursor-pointer"
            onClick={() => fileInputRef.current.click()}
            title="Change your picture"
          >
            <img
              src={selectedImg || authUser.profilePic || "/avatar.png"}
              alt="User image"
              className="size-full object-cover"
            />

            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <span className="text-white text-[9px]">Edit</span>
            </div>
          </button>
        </div>

        {/* ONLINE INDICATOR */}
        <span className="absolute bottom-0 right-0 size-3 rounded-full bg-green-500 border-2 border-surface-1" />

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageUpload}
          className="hidden"
        />
      </div>

      <div className="min-w-0 flex-1">
        <h3 className="text-slate-200 text-sm font-medium truncate">
          {authUser.fullName}
        </h3>
        <p className="text-slate-500 text-[11px] truncate">
          {activeVoiceChannel ? `In ${activeVoiceChannel.name}` : "Active"}
        </p>
      </div>

      {/* MIC, only meaningful while sitting in a voice channel */}
      <button
        type="button"
        onClick={toggleMute}
        disabled={!activeVoiceChannel}
        title={
          activeVoiceChannel
            ? isMuted
              ? "Unmute yourself in voice"
              : "Mute yourself in voice"
            : "Join a voice channel to use your mic"
        }
        className={`p-1 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
          isMuted ? "text-red-400 hover:text-red-300" : "icon-btn"
        }`}
      >
        {isMuted ? (
          <MicOffIcon className="size-4" />
        ) : (
          <MicIcon className="size-4" />
        )}
      </button>

      {/* NOTIFICATION SOUND TOGGLE */}
      <button
        type="button"
        className="icon-btn p-1"
        title="Notification sounds"
        onClick={() => {
          // play click sound before toggling
          mouseClickSound.currentTime = 0; // reset to start
          mouseClickSound
            .play()
            .catch((error) => console.log("Audio play failed:", error));
          toggleSound();
        }}
      >
        {isSoundEnabled ? (
          <Volume2Icon className="size-4" />
        ) : (
          <VolumeOffIcon className="size-4" />
        )}
      </button>

      <button
        type="button"
        className="icon-btn p-1"
        title="Log out"
        onClick={logout}
      >
        <LogOutIcon className="size-4" />
      </button>
    </div>
  );
}

export default UserFooterCard;
