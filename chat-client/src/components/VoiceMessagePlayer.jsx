import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

const BAR_COUNT = 28;

const formatTime = (seconds) => {
  const safe = Number.isFinite(seconds) ? Math.floor(seconds) : 0;
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
};

// stable bar heights per message, so the waveform doesn't jump on re-render
const getBars = (seed) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;

  return Array.from({ length: BAR_COUNT }, (_, i) => {
    hash = (hash * 1103515245 + 12345) | 0;
    return 35 + (Math.abs(hash >> (i % 8)) % 65);
  });
};

function VoiceMessagePlayer({ src, duration, messageId, isMine }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(duration || 0);

  const bars = getBars(messageId || src || "voice");
  const progress = totalTime > 0 ? currentTime / totalTime : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      // webm blobs often report Infinity until fully buffered, keep the
      // duration we stored on the message in that case
      if (Number.isFinite(audio.duration)) setTotalTime(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", () => setIsPlaying(false));

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch((e) => console.log("Audio play failed: ", e));
  };

  // let the user scrub by clicking a spot on the waveform
  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !totalTime) return;

    const { left, width } = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((e.clientX - left) / width, 0), 1);
    audio.currentTime = ratio * totalTime;
    setCurrentTime(audio.currentTime);
  };

  return (
    <div className="flex items-center gap-3 min-w-56 py-1">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        className={`size-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors cursor-pointer ${
          isMine
            ? "bg-white/20 text-white hover:bg-white/30"
            : "bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30"
        }`}
      >
        {isPlaying ? (
          <PauseIcon className="size-4" />
        ) : (
          <PlayIcon className="size-4" />
        )}
      </button>

      <div
        onClick={handleSeek}
        className="flex items-center gap-0.5 h-8 flex-1 cursor-pointer"
      >
        {bars.map((height, index) => {
          const isPlayed = index / BAR_COUNT <= progress;

          return (
            <span
              key={index}
              style={{ height: `${height}%` }}
              className={`flex-1 rounded-full transition-colors ${
                isMine
                  ? isPlayed
                    ? "bg-white"
                    : "bg-white/35"
                  : isPlayed
                    ? "bg-cyan-400"
                    : "bg-slate-600"
              }`}
            />
          );
        })}
      </div>

      <span
        className={`text-xs tabular-nums flex-shrink-0 ${
          isMine ? "text-white/80" : "text-slate-400"
        }`}
      >
        {formatTime(isPlaying || currentTime > 0 ? currentTime : totalTime)}
      </span>
    </div>
  );
}
export default VoiceMessagePlayer;
