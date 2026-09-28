import cloudinary from "./cloudinary.js";

// the largest voice note we accept, keeps a single request well inside the
// 10mb express.json limit (base64 inflates the payload by roughly a third)
export const MAX_AUDIO_SECONDS = 120;

// the cloudinary api rejects data urls that carry extra mime parameters, and
// MediaRecorder produces "audio/webm;codecs=opus", so keep just the media type
const stripMimeParams = (dataUrl) => {
  const separator = dataUrl.indexOf(",");
  if (separator === -1 || !dataUrl.startsWith("data:")) return dataUrl;

  const mimeType = dataUrl.slice(5, separator).split(";")[0];
  return `data:${mimeType};base64,${dataUrl.slice(separator + 1)}`;
};

// direct messages and channel messages carry the same attachments, so both
// send them here and answer upload failures with their own status code
export const uploadMessageAttachments = async ({ image, audio }) => {
  let imageUrl;
  let audioUrl;

  if (image) {
    const uploadResponse = await cloudinary.uploader.upload(image);
    imageUrl = uploadResponse.secure_url;
  }

  if (audio) {
    // cloudinary serves audio under the "video" resource type
    const uploadResponse = await cloudinary.uploader.upload(
      stripMimeParams(audio),
      {
        resource_type: "video",
        folder: "chatify/voice-messages",
      },
    );
    audioUrl = uploadResponse.secure_url;
  }

  return { imageUrl, audioUrl };
};
