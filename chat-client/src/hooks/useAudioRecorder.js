import { useEffect, useRef, useState } from "react";

export const MAX_RECORDING_SECONDS = 120;

// opus in a webm container is small and supported everywhere except safari,
// which needs mp4/aac instead
const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === "undefined") return null;
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const elapsedRef = useRef(0);
  const cancelledRef = useRef(false);
  const onMaxDurationRef = useRef(null);

  const isSupported =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  // always release the microphone, otherwise the browser keeps showing the
  // tab as recording
  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    elapsedRef.current = 0;

    setIsRecording(false);
    setRecordingTime(0);
  };

  // stop recording if the component unmounts mid take
  useEffect(() => cleanup, []);

  // onMaxDuration fires when the take hits the limit and is cut off
  const startRecording = async (onMaxDuration) => {
    if (!isSupported) {
      throw new Error("Your browser does not support voice messages.");
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined,
    );

    streamRef.current = stream;
    mediaRecorderRef.current = recorder;
    chunksRef.current = [];
    elapsedRef.current = 0;
    cancelledRef.current = false;
    onMaxDurationRef.current = onMaxDuration;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    // baseline handlers, stopRecording swaps these for ones that settle its
    // promise. Without them a cancel or a failure would never release the mic.
    recorder.onstop = cleanup;
    recorder.onerror = cleanup;

    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);

    timerRef.current = setInterval(() => {
      elapsedRef.current += 1;
      setRecordingTime(elapsedRef.current);

      // cut the take off at the limit so we never build a payload the server
      // would reject
      if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        onMaxDurationRef.current?.();
      }
    }, 1000);

    return recorder;
  };

  // resolves with the recording as a base64 data url, the same shape the
  // image input already sends to the server
  const stopRecording = () =>
    new Promise((resolve, reject) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") return resolve(null);

      const duration = elapsedRef.current;

      recorder.onstop = () => {
        if (cancelledRef.current) {
          cleanup();
          return resolve(null);
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        cleanup();

        if (blob.size === 0) {
          return reject(new Error("Nothing was recorded."));
        }

        const reader = new FileReader();
        reader.onloadend = () =>
          resolve({ audio: reader.result, duration: Math.max(duration, 1) });
        reader.onerror = () =>
          reject(new Error("Could not read the recording."));
        reader.readAsDataURL(blob);
      };

      recorder.onerror = () => {
        cleanup();
        reject(new Error("Recording failed."));
      };

      recorder.stop();
    });

  // discard the take instead of turning it into a message
  const cancelRecording = () => {
    cancelledRef.current = true;
    const recorder = mediaRecorderRef.current;

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = cleanup;
      recorder.stop();
    } else {
      cleanup();
    }
  };

  return {
    isRecording,
    recordingTime,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

export default useAudioRecorder;
