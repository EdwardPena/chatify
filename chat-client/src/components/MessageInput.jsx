import { useRef, useState } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import useAudioRecorder, {
  MAX_RECORDING_SECONDS,
} from "../hooks/useAudioRecorder";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import {
  ImageIcon,
  MicIcon,
  SendIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import VoiceMessagePlayer from "./VoiceMessagePlayer";

const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

function MessageInput() {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);

  const fileInputRef = useRef(null);

  const { sendMessage, isSoundEnabled } = useChatStore();
  const {
    isRecording,
    recordingTime,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecorder();

  const handleStopRecording = async () => {
    try {
      const recording = await stopRecording();
      if (recording) setAudioPreview(recording);
    } catch (error) {
      console.log("Error stopping recording: ", error);
      toast.error(error.message || "Recording failed");
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview && !audioPreview) return;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    sendMessage({
      text: text.trim(),
      image: imagePreview,
      audio: audioPreview?.audio,
      audioDuration: audioPreview?.duration,
    });

    setText("");
    setImagePreview("");
    setAudioPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleStartRecording = async () => {
    if (!isSupported) {
      toast.error("Your browser does not support voice messages");
      return;
    }

    try {
      // the recorder cuts the take off at the limit and calls this back
      await startRecording(() => {
        handleStopRecording();
        toast.success(`Voice messages stop at ${MAX_RECORDING_SECONDS} seconds`);
      });
    } catch (error) {
      console.log("Error starting recording: ", error);

      if (error.name === "NotAllowedError") {
        toast.error("Microphone access denied. Allow it in your browser settings");
      } else if (error.name === "NotFoundError") {
        toast.error("No microphone found");
      } else {
        toast.error(error.message || "Could not start recording");
      }
    }
  };

  const hasContent = text.trim() || imagePreview || audioPreview;

  return (
    <div className="p-4 border-t border-slate-700/50">
      {imagePreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative">
            <img
              src={imagePreview}
              alt="Preview"
              className="w-20 h-20 object-cover rounded-lg border border-slate-700"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {audioPreview && (
        <div className="max-w-3xl mx-auto mb-3 flex items-center">
          <div className="relative bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-1">
            <VoiceMessagePlayer
              src={audioPreview.audio}
              duration={audioPreview.duration}
              messageId="preview"
            />
            <button
              onClick={() => setAudioPreview(null)}
              className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-slate-200 hover:bg-slate-700"
              type="button"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSendMessage}
        className="max-w-3xl mx-auto flex space-x-4"
      >
        {isRecording ? (
          <div className="flex-1 flex items-center gap-3 bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-4">
            <span className="size-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-slate-200 text-sm tabular-nums">
              {formatTime(recordingTime)}
            </span>
            <span className="text-slate-400 text-sm truncate">
              Recording... tap the square to finish
            </span>

            <button
              type="button"
              onClick={cancelRecording}
              title="Discard recording"
              className="ml-auto text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2Icon className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <input
            type="text"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              isSoundEnabled && playRandomKeyStrokeSound();
            }}
            className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg py-2 px-4"
            placeholder="Type your message..."
          />
        )}

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isRecording}
          className={`bg-slate-800/50 text-slate-400 hover:text-slate-200 rounded-lg px-4 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
            imagePreview ? "text-cyan-500" : ""
          }`}
        >
          <ImageIcon className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          title={isRecording ? "Finish recording" : "Record a voice message"}
          className={`bg-slate-800/50 rounded-lg px-4 transition-colors ${
            isRecording
              ? "text-red-400 hover:text-red-300"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          {isRecording ? (
            <SquareIcon className="w-5 h-5" />
          ) : (
            <MicIcon className="w-5 h-5" />
          )}
        </button>

        <button
          type="submit"
          disabled={!hasContent || isRecording}
          className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg px-4 py-2 font-medium hover:from-cyan-600 hover:to-cyan-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <SendIcon className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}

export default MessageInput;
