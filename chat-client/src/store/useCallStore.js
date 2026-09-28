import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

// a direct call is one peer connection between two people, the same webrtc
// pattern the voice channels use, only without the mesh
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// the connection and the local tracks are not state, they never render
let peer = null;
let localStream = null;
// candidates that arrive before the remote description is set have nowhere
// to go yet, so they wait here
let pendingCandidates = [];

const stopLocalStream = () => {
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
};

const closePeer = () => {
  if (!peer) return;
  peer.onicecandidate = null;
  peer.ontrack = null;
  peer.close();
  peer = null;
  pendingCandidates = [];
};

export const useCallStore = create((set, get) => ({
  // the person we are ringing, waiting on, or talking to
  activeCall: null, // { callId, user, withVideo, isConnected }
  incomingCall: null, // { callId, from, withVideo }
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOn: false,

  getMedia: async (withVideo) => {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: withVideo ? { width: 1280, height: 720 } : false,
    });
    set({ localStream, isCameraOn: withVideo, isMuted: false });
    return localStream;
  },

  buildPeer: (callId) => {
    const socket = useAuthStore.getState().socket;
    closePeer();

    peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    localStream?.getTracks().forEach((t) => peer.addTrack(t, localStream));

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      socket?.emit("call:signal", {
        callId,
        signal: { candidate: event.candidate },
      });
    };

    peer.ontrack = (event) => {
      set({ remoteStream: event.streams[0] });
      set({ activeCall: { ...get().activeCall, isConnected: true } });
    };

    return peer;
  },

  startCall: async (user, withVideo = false) => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    if (get().activeCall) return toast.error("You are already in a call");

    if (!navigator.mediaDevices?.getUserMedia) {
      return toast.error("Your browser does not support calls");
    }

    try {
      await get().getMedia(withVideo);
    } catch (error) {
      console.log("Error opening the microphone: ", error);
      return toast.error(
        error.name === "NotAllowedError"
          ? "Microphone access denied. Allow it in your browser settings"
          : "Could not start the call",
      );
    }

    set({ activeCall: { callId: null, user, withVideo, isConnected: false } });
    socket.emit("call:invite", { toUserId: user._id, withVideo });
  },

  acceptCall: async () => {
    const socket = useAuthStore.getState().socket;
    const { incomingCall } = get();
    if (!socket || !incomingCall) return;

    try {
      await get().getMedia(incomingCall.withVideo);
    } catch (error) {
      console.log("Error opening the microphone: ", error);
      toast.error("Could not open your microphone");
      return get().declineCall();
    }

    set({
      activeCall: {
        callId: incomingCall.callId,
        user: incomingCall.from,
        withVideo: incomingCall.withVideo,
        isConnected: false,
      },
      incomingCall: null,
    });

    // the caller sends the offer, we only need the connection ready for it
    get().buildPeer(incomingCall.callId);
    socket.emit("call:accept", { callId: incomingCall.callId });
  },

  declineCall: () => {
    const { incomingCall } = get();
    if (!incomingCall) return;

    useAuthStore.getState().socket?.emit("call:decline", {
      callId: incomingCall.callId,
    });
    set({ incomingCall: null });
  },

  endCall: (silent = false) => {
    const { activeCall } = get();
    if (activeCall?.callId && !silent) {
      useAuthStore.getState().socket?.emit("call:end", {
        callId: activeCall.callId,
      });
    }

    closePeer();
    stopLocalStream();
    set({
      activeCall: null,
      localStream: null,
      remoteStream: null,
      isMuted: false,
      isCameraOn: false,
    });
  },

  toggleMute: () => {
    if (!localStream) return;
    const muted = !get().isMuted;
    localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    set({ isMuted: muted });
  },

  toggleCamera: async () => {
    if (!localStream || !peer) return;

    const [videoTrack] = localStream.getVideoTracks();

    // the call started without a camera, so there is no track to flip yet
    if (!videoTrack) {
      try {
        const camera = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
        });
        const track = camera.getVideoTracks()[0];
        localStream.addTrack(track);
        peer.addTrack(track, localStream);
        set({ isCameraOn: true, localStream });

        // adding a track renegotiates, and the offer has to come from here
        const offer = await peer.createOffer();
        await peer.setLocalDescription(offer);
        useAuthStore.getState().socket?.emit("call:signal", {
          callId: get().activeCall.callId,
          signal: { description: peer.localDescription },
        });
      } catch (error) {
        console.log("Error opening the camera: ", error);
        toast.error("Could not open your camera");
      }
      return;
    }

    videoTrack.enabled = !videoTrack.enabled;
    set({ isCameraOn: videoTrack.enabled });
  },

  initCallListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    get().removeCallListener();

    socket.on("call:incoming", ({ callId, from, withVideo }) => {
      // already busy: turn it down rather than letting it ring forever
      if (get().activeCall || get().incomingCall) {
        return socket.emit("call:decline", { callId });
      }
      set({ incomingCall: { callId, from, withVideo } });
    });

    socket.on("call:ringing", ({ callId }) => {
      if (!get().activeCall) return;
      set({ activeCall: { ...get().activeCall, callId } });
    });

    // they picked up, so this side makes the offer
    socket.on("call:accepted", async ({ callId }) => {
      const { activeCall } = get();
      if (activeCall?.callId !== callId) return;

      try {
        const connection = get().buildPeer(callId);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        socket.emit("call:signal", {
          callId,
          signal: { description: connection.localDescription },
        });
      } catch (error) {
        console.log("Error creating the call offer: ", error);
        get().endCall();
      }
    });

    socket.on("call:signal", async ({ callId, signal }) => {
      if (get().activeCall?.callId !== callId || !peer) return;

      try {
        if (signal.description) {
          await peer.setRemoteDescription(signal.description);

          // whatever arrived early can be added now
          for (const candidate of pendingCandidates) {
            await peer.addIceCandidate(candidate).catch(() => {});
          }
          pendingCandidates = [];

          if (signal.description.type === "offer") {
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            socket.emit("call:signal", {
              callId,
              signal: { description: peer.localDescription },
            });
          }
          return;
        }

        if (signal.candidate) {
          if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
          else pendingCandidates.push(signal.candidate);
        }
      } catch (error) {
        console.log("Error handling call signal: ", error);
      }
    });

    socket.on("call:ended", ({ callId, reason }) => {
      if (get().incomingCall?.callId === callId) set({ incomingCall: null });
      if (get().activeCall?.callId !== callId && get().activeCall) return;

      if (reason === "declined") toast("Call declined");
      else if (reason === "disconnected") toast("The call dropped");

      get().endCall(true);
    });

    // another tab of ours answered or dismissed this call
    socket.on("call:handled", ({ callId }) => {
      if (get().incomingCall?.callId === callId) set({ incomingCall: null });
    });

    socket.on("call:failed", ({ message }) => {
      toast.error(message);
      get().endCall(true);
    });
  },

  removeCallListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    [
      "call:incoming",
      "call:ringing",
      "call:accepted",
      "call:signal",
      "call:ended",
      "call:handled",
      "call:failed",
    ].forEach((event) => socket.off(event));
  },
}));
