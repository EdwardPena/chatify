import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

// a mesh of direct connections: fine for the handful of people a voice
// channel actually holds, and it needs no media server of our own
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// connections are live objects, not state: they never render and copying them
// would break them, so they live beside the store
const peers = new Map(); // userId -> { pc, videoSender, makingOffer, ignoreOffer, polite }

let micStream = null; // our microphone, open for as long as we are connected
let videoTrack = null; // the camera or the screen, whichever is being sent
let videoStream = null; // kept so the whole capture can be stopped later

const emitSignal = (toUserId, signal) => {
  const { socket } = useAuthStore.getState();
  const channelId = useVoiceStore.getState().activeVoiceChannel?._id;
  if (socket && channelId) socket.emit("voice:signal", { channelId, toUserId, signal });
};

const closePeer = (userId) => {
  const peer = peers.get(userId);
  if (!peer) return;

  peer.pc.onicecandidate = null;
  peer.pc.ontrack = null;
  peer.pc.onnegotiationneeded = null;
  peer.pc.close();
  peers.delete(userId);
};

const closeAllPeers = () => [...peers.keys()].forEach(closePeer);

const releaseVideoCapture = () => {
  videoStream?.getTracks().forEach((track) => track.stop());
  videoTrack = null;
  videoStream = null;
};

const stopEverything = () => {
  micStream?.getTracks().forEach((track) => track.stop());
  micStream = null;
  releaseVideoCapture();
};

export const useVoiceStore = create((set, get) => ({
  activeVoiceChannel: null,
  remoteStreams: {}, // userId -> MediaStream, one tile per entry
  // a MediaStream gaining a track does not re-render react on its own, so the
  // tiles watch this counter instead
  streamVersion: 0,
  isMuted: false,
  isCameraOn: false,
  isSharingScreen: false,
  isConnecting: false,

  bumpStreams: () => set({ streamVersion: get().streamVersion + 1 }),

  // tells everyone else what our microphone, camera and screen are doing
  announceMedia: () => {
    const { activeVoiceChannel, isMuted, isCameraOn, isSharingScreen } = get();
    if (!activeVoiceChannel) return;

    useAuthStore.getState().socket?.emit("voice:media", {
      channelId: activeVoiceChannel._id,
      isMuted,
      isCameraOn,
      isSharingScreen,
    });
  },

  createPeer: (userId) => {
    const { authUser } = useAuthStore.getState();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // exactly one side of each pair yields when two offers cross, which is
    // what keeps camera and screen toggles from deadlocking the connection
    const peer = {
      pc,
      videoSender: null,
      makingOffer: false,
      ignoreOffer: false,
      polite: String(authUser._id) < String(userId),
    };
    peers.set(userId, peer);

    micStream?.getTracks().forEach((track) => pc.addTrack(track, micStream));
    if (videoTrack) peer.videoSender = pc.addTrack(videoTrack, videoStream);

    pc.onicecandidate = (event) => {
      if (event.candidate) emitSignal(userId, { candidate: event.candidate });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      set({ remoteStreams: { ...get().remoteStreams, [userId]: stream } });

      // a camera switched on later arrives on the stream we already have
      stream.onaddtrack = () => get().bumpStreams();
      stream.onremovetrack = () => get().bumpStreams();
      event.track.onmute = () => get().bumpStreams();
      event.track.onunmute = () => get().bumpStreams();
      get().bumpStreams();
    };

    // adding or removing a track raises this, on whichever side did it
    pc.onnegotiationneeded = async () => {
      try {
        peer.makingOffer = true;
        await pc.setLocalDescription();
        emitSignal(userId, { description: pc.localDescription });
      } catch (error) {
        console.log("Error renegotiating: ", error);
      } finally {
        peer.makingOffer = false;
      }
    };

    return peer;
  },

  // pushes whatever we are capturing to everyone already connected
  publishVideo: () => {
    peers.forEach((peer) => {
      if (peer.videoSender) {
        peer.videoSender.replaceTrack(videoTrack);
      } else if (videoTrack) {
        // the first video track needs a new sender, which renegotiates once
        peer.videoSender = peer.pc.addTrack(videoTrack, videoStream);
      }
    });
  },

  joinVoiceChannel: async (channel) => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    if (get().activeVoiceChannel?._id === channel._id) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Your browser does not support voice channels");
      return;
    }

    set({ isConnecting: true });
    try {
      // hang up wherever we were before dialing into the new room
      if (get().activeVoiceChannel) get().leaveVoiceChannel();

      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      set({
        activeVoiceChannel: channel,
        isMuted: false,
        isCameraOn: false,
        isSharingScreen: false,
      });
      socket.emit("voice:join", { channelId: channel._id });
    } catch (error) {
      console.log("Error joining voice channel: ", error);

      if (error.name === "NotAllowedError") {
        toast.error("Microphone access denied. Allow it in your browser settings");
      } else if (error.name === "NotFoundError") {
        toast.error("No microphone found");
      } else {
        toast.error("Could not join the voice channel");
      }
      stopEverything();
      set({ activeVoiceChannel: null });
    } finally {
      set({ isConnecting: false });
    }
  },

  leaveVoiceChannel: () => {
    const socket = useAuthStore.getState().socket;
    const { activeVoiceChannel } = get();
    if (!activeVoiceChannel) return;

    socket?.emit("voice:leave", { channelId: activeVoiceChannel._id });

    closeAllPeers();
    stopEverything();
    set({
      activeVoiceChannel: null,
      remoteStreams: {},
      isMuted: false,
      isCameraOn: false,
      isSharingScreen: false,
    });
  },

  toggleMute: () => {
    const { activeVoiceChannel, isMuted } = get();
    if (!activeVoiceChannel || !micStream) return;

    const muted = !isMuted;
    // muting is local: the track keeps flowing, it just carries silence
    micStream.getAudioTracks().forEach((track) => (track.enabled = !muted));
    set({ isMuted: muted });
    get().announceMedia();
  },

  // the camera and the screen share the one video slot, so turning one on
  // replaces the other rather than sending two streams
  startVideo: async (source) => {
    const { activeVoiceChannel } = get();
    if (!activeVoiceChannel) return;

    const isScreen = source === "screen";
    if (isScreen && !navigator.mediaDevices?.getDisplayMedia) {
      return toast.error("Your browser cannot share a screen");
    }

    try {
      const stream = isScreen
        ? await navigator.mediaDevices.getDisplayMedia({ video: true })
        : await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
          });

      releaseVideoCapture();
      videoStream = stream;
      videoTrack = stream.getVideoTracks()[0];

      // the browser's own "stop sharing" bar ends the track behind our back
      videoTrack.onended = () => get().stopVideo();

      set({ isCameraOn: !isScreen, isSharingScreen: isScreen });
      get().publishVideo();
      get().announceMedia();
      get().bumpStreams();
    } catch (error) {
      console.log("Error starting video: ", error);
      // the picker was dismissed, which is a choice and not a failure
      if (error.name === "NotAllowedError" && isScreen) return;

      toast.error(
        isScreen ? "Could not share your screen" : "Could not open your camera",
      );
    }
  },

  stopVideo: () => {
    if (!videoTrack) return;

    releaseVideoCapture();
    // keep the sender in place with nothing on it, so stopping the camera
    // costs no renegotiation
    peers.forEach((peer) => peer.videoSender?.replaceTrack(null));
    set({ isCameraOn: false, isSharingScreen: false });
    get().announceMedia();
    get().bumpStreams();
  },

  toggleCamera: () =>
    get().isCameraOn ? get().stopVideo() : get().startVideo("camera"),

  toggleScreenShare: () =>
    get().isSharingScreen ? get().stopVideo() : get().startVideo("screen"),

  // what our own tile should show
  getLocalVideoStream: () => videoStream,

  initVoiceListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    get().removeVoiceListener();

    // whoever arrives last calls everyone already in the room, and adding our
    // tracks is what raises the first offer
    socket.on("voice:peers", ({ channelId, peers: existing }) => {
      if (get().activeVoiceChannel?._id !== channelId) return;
      existing.forEach((user) => get().createPeer(user._id));
      get().announceMedia();
    });

    // whoever arrives after us simply calls in, and the signal handler below
    // answers, so there is nothing to do on voice:userJoined

    socket.on("voice:userLeft", ({ channelId, userId }) => {
      if (get().activeVoiceChannel?._id !== channelId) return;

      closePeer(userId);
      const remoteStreams = { ...get().remoteStreams };
      delete remoteStreams[userId];
      set({ remoteStreams });
    });

    socket.on("voice:signal", async ({ channelId, fromUserId, signal }) => {
      if (get().activeVoiceChannel?._id !== channelId) return;

      const peer = peers.get(fromUserId) || get().createPeer(fromUserId);

      try {
        if (signal.description) {
          // both sides offered at once: the impolite side keeps its own offer
          const collision =
            signal.description.type === "offer" &&
            (peer.makingOffer || peer.pc.signalingState !== "stable");

          peer.ignoreOffer = !peer.polite && collision;
          if (peer.ignoreOffer) return;

          await peer.pc.setRemoteDescription(signal.description);

          if (signal.description.type === "offer") {
            await peer.pc.setLocalDescription();
            emitSignal(fromUserId, { description: peer.pc.localDescription });
          }
          return;
        }

        if (signal.candidate) {
          try {
            await peer.pc.addIceCandidate(signal.candidate);
          } catch (error) {
            // a candidate for an offer we deliberately ignored is expected
            if (!peer.ignoreOffer) throw error;
          }
        }
      } catch (error) {
        console.log("Error handling voice signal: ", error);
      }
    });
  },

  removeVoiceListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    ["voice:peers", "voice:userLeft", "voice:signal"].forEach((event) =>
      socket.off(event),
    );
  },
}));
