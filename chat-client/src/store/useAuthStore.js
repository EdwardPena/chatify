import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:3000" : "/";

// signing out has to leave nothing behind: the next person to sign in on this
// browser must not inherit the last one's servers, chats or contacts
const resetAppState = async () => {
  const [servers, chats, contacts] = await Promise.all([
    import("./useServerStore"),
    import("./useChatStore"),
    import("./useContactStore"),
  ]);

  servers.useServerStore.getState().reset();
  chats.useChatStore.getState().reset();
  contacts.useContactStore.getState().reset();
};

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isLoggingIn: false,
  isSendingResetLink: false,
  isResettingPassword: false,
  socket: null,
  onlineUsers: [],

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log("Error in authCheck:", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });

      toast.success("Account created successfully!");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });

      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isLoggingIn: false });
    }
  },

  googleLogin: async (credential) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/google", { credential });
      set({ authUser: res.data });

      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Google sign in failed");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      await get().disconnectSocket();
      await resetAppState();
    } catch (error) {
      toast.error("Error logging out");
      console.log("Logout error:", error);
    }
  },

  forgotPassword: async (data) => {
    set({ isSendingResetLink: true });
    try {
      const res = await axiosInstance.post("/auth/forgot-password", data);
      toast.success(res.data.message);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
      return false;
    } finally {
      set({ isSendingResetLink: false });
    }
  },

  resetPassword: async (token, data) => {
    set({ isResettingPassword: true });
    try {
      const res = await axiosInstance.post(
        `/auth/reset-password/${token}`,
        data,
      );
      toast.success(res.data.message);
      return true;
    } catch (error) {
      toast.error(error.response?.data?.message || "Something went wrong");
      return false;
    } finally {
      set({ isResettingPassword: false });
    }
  },

  updateProfile: async (data) => {
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      console.log("Error in update profile:", error);
      toast.error(error.response.data.message);
    }
  },

  connectSocket: () => {
    const { authUser, socket } = get();
    if (!authUser) return;
    if (socket) return;

    const newSocket = io(BASE_URL, {
      withCredentials: true,
    });

    set({ socket: newSocket });

    newSocket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    import("./useChatStore").then(({ useChatStore }) => {
      useChatStore.getState().initMessageListener();
    });

    import("./useContactStore").then(({ useContactStore }) => {
      useContactStore.getState().initContactListener();
    });

    import("./useServerStore").then(({ useServerStore }) => {
      useServerStore.getState().initServerListener();
    });

    import("./useVoiceStore").then(({ useVoiceStore }) => {
      useVoiceStore.getState().initVoiceListener();
    });

    import("./useCallStore").then(({ useCallStore }) => {
      useCallStore.getState().initCallListener();
    });
  },

  disconnectSocket: async () => {
    const { socket } = get();
    if (!socket) return;

    // hang up before the socket goes, otherwise these emits land on a closed
    // connection and the other side only finds out via the disconnect
    const [voice, calls] = await Promise.all([
      import("./useVoiceStore"),
      import("./useCallStore"),
    ]);
    voice.useVoiceStore.getState().leaveVoiceChannel();
    calls.useCallStore.getState().endCall();

    socket.disconnect();
    set({ socket: null });
  },
}));
// authUser: { name: "jhon", _id: 123, age: 25 },
// isLoggedIn: false,
// isLoading: false,

// login: () => {
//   console.log("We just logged in");
//   set({ isLoggedIn: true, isLoading: true });
//   get().isLoading === true
//     ? console.log("Loading is true")
//     : console.log("Loading is false");
// },
