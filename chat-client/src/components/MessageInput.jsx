import { useRef, useState } from "react";
import useKeyboardSound from "../hooks/useKeyboardSound";
import useAudioRecorder, {
  MAX_RECORDING_SECONDS,
} from "../hooks/useAudioRecorder";
import { useChatStore } from "../store/useChatStore";
import toast from "react-hot-toast";
import {
  AtSignIcon,
  ImageIcon,
  MicIcon,
  SendIcon,
  SmileIcon,
  SquareIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import VoiceMessagePlayer from "./VoiceMessagePlayer";
import EmojiPicker from "./EmojiPicker";
import MentionPicker from "./MentionPicker";
import ReplyPreview from "./ReplyPreview";

const formatTime = (seconds) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

// an @ typed into the message opens the same list the button does
const MENTION_TRIGGER = /(?:^|\s)@([\w.-]*)$/;

// the same composer serves direct messages and channels, the caller decides
// where what you type ends up
function MessageInput({
  onSend,
  placeholder = "Type your message...",
  mentionables = [],
  replyingTo = null,
  replyAuthor = "",
  onCancelReply,
}) {
  const { playRandomKeyStrokeSound } = useKeyboardSound();
  const [text, setText] = useState("");
  const [imagePreview, setImagePreview] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [openPicker, setOpenPicker] = useState(null);

  const [mentionQuery, setMentionQuery] = useState(null);

  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  // clicking a picker takes focus off the field, so where the caret was has
  // to be remembered before that happens
  const caretRef = useRef(0);

  const rememberCaret = () => {
    const el = textInputRef.current;
    if (el) caretRef.current = el.selectionStart ?? el.value.length;
  };

  // drops a snippet where the caret is, optionally swallowing the characters
  // just before it (the half typed @handle, say)
  const insertAtCaret = (snippet, replaceLength = 0) => {
    const caret = caretRef.current;
    const before = text.slice(0, Math.max(0, caret - replaceLength));
    const after = text.slice(caret);
    // pad only where padding is missing, so nothing ends up double spaced
    const spacer = before && !/\s$/.test(before) ? " " : "";
    const trailing = /^\s/.test(after) ? "" : " ";
    const piece = `${spacer}${snippet}${trailing}`;

    setText(before + piece + after);
    setOpenPicker(null);
    setMentionQuery(null);

    // put the caret back, just past what we inserted
    const position = (before + piece).length;
    requestAnimationFrame(() => {
      const el = textInputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(position, position);
      caretRef.current = position;
    });
  };

  const handleTextChange = (event) => {
    const { value, selectionStart } = event.target;
    setText(value);
    caretRef.current = selectionStart ?? value.length;
    if (isSoundEnabled) playRandomKeyStrokeSound();

    const typed = value.slice(0, caretRef.current).match(MENTION_TRIGGER);
    if (typed) {
      setMentionQuery(typed[1]);
      setOpenPicker("mention");
    } else if (mentionQuery !== null) {
      setMentionQuery(null);
      setOpenPicker((current) => (current === "mention" ? null : current));
    }
  };

  const matchingPeople = mentionables.filter((person) => {
    if (!mentionQuery) return true;
    const needle = mentionQuery.toLowerCase();
    return (
      person.username?.toLowerCase().includes(needle) ||
      person.fullName?.toLowerCase().includes(needle)
    );
  });

  const pickMention = (person) =>
    // typing the @ inline means those characters are replaced, the button
    // just inserts
    insertAtCaret(
      `@${person.username}`,
      mentionQuery === null ? 0 : mentionQuery.length + 1,
    );

  // while the list is up, Enter takes the highlighted name instead of sending
  const handleKeyDown = (event) => {
    if (openPicker !== "mention" || matchingPeople.length === 0) return;

    if (event.key === "Enter") {
      event.preventDefault();
      pickMention(matchingPeople[0]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpenPicker(null);
      setMentionQuery(null);
    }
  };

  const { isSoundEnabled } = useChatStore();
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

    onSend({
      text: text.trim(),
      image: imagePreview,
      audio: audioPreview?.audio,
      audioDuration: audioPreview?.duration,
    });

    setText("");
    setImagePreview("");
    setAudioPreview(null);
    setOpenPicker(null);
    setMentionQuery(null);
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
    <div className="px-6 pb-6 pt-2 relative">
      {/* the pickers sit above the whole composer rather than inside it: the
          form clips to its rounded corners, and anchoring them in there cut
          them off. Floating above also keeps the field readable while an
          @handle is being typed. */}
      {openPicker === "emoji" && (
        <EmojiPicker
          onPick={(emoji) => insertAtCaret(emoji)}
          onClose={() => setOpenPicker(null)}
        />
      )}

      {openPicker === "mention" && (
        <MentionPicker
          people={matchingPeople}
          query={mentionQuery}
          onPick={pickMention}
          onClose={() => {
            setOpenPicker(null);
            setMentionQuery(null);
          }}
        />
      )}

      <form
        onSubmit={handleSendMessage}
        className="bg-surface-3 border border-edge rounded-xl overflow-hidden focus-within:border-brand/60 transition-colors"
      >
        {replyingTo && (
          <ReplyPreview
            message={replyingTo}
            authorName={replyAuthor}
            onCancel={onCancelReply}
          />
        )}

        {(imagePreview || audioPreview) && (
          <div className="flex items-center gap-3 px-4 pt-4">
            {imagePreview && (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-20 h-20 object-cover rounded-lg border border-edge"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 size-6 rounded-full bg-surface-4 flex items-center justify-center text-slate-200 hover:bg-surface-3 cursor-pointer"
                  type="button"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            )}

            {audioPreview && (
              <div className="relative bg-surface-1 border border-edge rounded-lg px-3 py-1">
                <VoiceMessagePlayer
                  src={audioPreview.audio}
                  duration={audioPreview.duration}
                  messageId="preview"
                />
                <button
                  onClick={() => setAudioPreview(null)}
                  className="absolute -top-2 -right-2 size-6 rounded-full bg-surface-4 flex items-center justify-center text-slate-200 hover:bg-surface-3 cursor-pointer"
                  type="button"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            )}
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <span className="size-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
            <span className="text-slate-200 text-sm tabular-nums">
              {formatTime(recordingTime)}
            </span>
            <span className="text-slate-500 text-sm truncate">
              Recording... tap the square to finish
            </span>

            <button
              type="button"
              onClick={cancelRecording}
              title="Discard recording"
              className="ml-auto text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
            >
              <Trash2Icon className="size-5" />
            </button>
          </div>
        ) : (
          <input
            ref={textInputRef}
            type="text"
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            onSelect={rememberCaret}
            onBlur={rememberCaret}
            className="w-full bg-transparent px-4 py-4 text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
            placeholder={placeholder}
          />
        )}

        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageChange}
          className="hidden"
        />

        {/* the action bar under the field, the way the mock lays it out */}
        <div className="flex items-center gap-1 px-3 py-2 border-t border-edge">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecording}
            title="Attach an image"
            className={`p-1.5 rounded-md hover:bg-surface-4 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              imagePreview ? "text-brand-soft" : "text-slate-500 hover:text-slate-200"
            }`}
          >
            <ImageIcon className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              rememberCaret();
              setOpenPicker(openPicker === "emoji" ? null : "emoji");
            }}
            title="Emoji"
            className={`p-1.5 rounded-md hover:bg-surface-4 transition-colors cursor-pointer ${
              openPicker === "emoji"
                ? "text-brand-soft"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            <SmileIcon className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => {
              rememberCaret();
              setMentionQuery(null);
              setOpenPicker(openPicker === "mention" ? null : "mention");
            }}
            title="Mention someone"
            className={`p-1.5 rounded-md hover:bg-surface-4 transition-colors cursor-pointer ${
              openPicker === "mention"
                ? "text-brand-soft"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            <AtSignIcon className="size-4" />
          </button>

          <button
            type="button"
            onClick={isRecording ? handleStopRecording : handleStartRecording}
            title={isRecording ? "Finish recording" : "Record a voice message"}
            className={`p-1.5 rounded-md hover:bg-surface-4 transition-colors cursor-pointer ${
              isRecording
                ? "text-red-400 hover:text-red-300"
                : "text-slate-500 hover:text-slate-200"
            }`}
          >
            {isRecording ? (
              <SquareIcon className="size-4" />
            ) : (
              <MicIcon className="size-4" />
            )}
          </button>

          <span className="ml-auto text-[11px] text-slate-600 hidden sm:block">
            Return to send
          </span>

          <button
            type="submit"
            disabled={!hasContent || isRecording}
            className="ml-2 primary-btn inline-flex items-center gap-2"
          >
            Send
            <SendIcon className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

export default MessageInput;
