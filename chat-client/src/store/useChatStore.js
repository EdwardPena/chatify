import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  chats: [],
  messages: [],
  activeTab: "chats",
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isSoundEnabled: JSON.parse(localStorage.getItem("isSoundEnabled")) === true,
  unreadCounts: {}, // { [userId]: unread chats }
  replyingTo: null, // the message the composer is currently answering

  setReplyingTo: (message) => set({ replyingTo: message }),

  // wipes everything that belonged to the last person signed in here
  reset: () =>
    set({
      chats: [],
      messages: [],
      activeTab: "chats",
      selectedUser: null,
      replyingTo: null,
      unreadCounts: {},
      isUsersLoading: false,
      isMessagesLoading: false,
    }),

  toggleSound: () => {
    localStorage.setItem("isSoundEnabled", !get().isSoundEnabled);
    set({ isSoundEnabled: !get().isSoundEnabled });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSelectedUser: (selectedUser) => {
    set({ selectedUser, replyingTo: null });

    // al abrir un chat, resetea su contador de no leídos
    if (selectedUser) {
      set((state) => ({
        unreadCounts: { ...state.unreadCounts, [selectedUser._id]: 0 },
      }));
    }
  },

  getMyChatPartners: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("messages/chats");
      set({ chats: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessagesByUserId: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      set({ messages: res.data });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    const { selectedUser, replyingTo } = get();
    const { authUser } = useAuthStore.getState();
    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      senderId: authUser._id,
      receiverId: selectedUser._id,
      text: messageData.text,
      image: messageData.image,
      // the base64 data url plays fine locally while the upload is in flight
      audio: messageData.audio,
      audioDuration: messageData.audioDuration,
      replyTo: replyingTo,
      status: "sent",
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    set({ messages: [...get().messages, optimisticMessage], replyingTo: null });

    try {
      const res = await axiosInstance.post(
        `/messages/send/${selectedUser._id}`,
        { ...messageData, replyTo: replyingTo?._id },
      );
      set({
        messages: get().messages.map((msg) =>
          msg._id === tempId ? res.data : msg,
        ),
      });
    } catch (error) {
      set({
        messages: get().messages.filter((msg) => msg._id !== tempId),
      });
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  searchMessages: async (term) => {
    const { selectedUser } = get();
    if (!selectedUser || !term.trim()) return [];

    try {
      const res = await axiosInstance.get(`/messages/${selectedUser._id}`, {
        params: { search: term.trim() },
      });
      return res.data;
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
      return [];
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
      set({ messages: get().messages.filter((msg) => msg._id !== messageId) });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  initMessageListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newMessage");
    socket.off("messageDeleted");
    socket.off("messagesDelivered");
    socket.off("messagesRead");

    socket.on("messagesDelivered", ({ messageIds }) => {
      const ids = new Set(messageIds);
      set({
        messages: get().messages.map((msg) =>
          ids.has(msg._id) && msg.status === "sent"
            ? { ...msg, status: "delivered" }
            : msg,
        ),
      });
    });

    socket.on("messagesRead", ({ messageIds }) => {
      const ids = new Set(messageIds);
      set({
        messages: get().messages.map((msg) =>
          ids.has(msg._id) ? { ...msg, status: "read" } : msg,
        ),
      });
    });

    socket.on("messageDeleted", ({ messageId }) => {
      set({ messages: get().messages.filter((msg) => msg._id !== messageId) });
    });

    socket.on("newMessage", (newMessage) => {
      const { selectedUser, isSoundEnabled } = get();
      const isChatOpen =
        selectedUser && newMessage.senderId === selectedUser._id;

      if (isChatOpen) {
        set({ messages: [...get().messages, newMessage] });
        // we are looking right at it, so it is read on arrival
        socket.emit("messages:read", { fromUserId: newMessage.senderId });
      } else {
        set((state) => ({
          unreadCounts: {
            ...state.unreadCounts,
            [newMessage.senderId]:
              (state.unreadCounts[newMessage.senderId] || 0) + 1,
          },
        }));

        // first message from this person: they are not in the list yet, so the
        // unread badge would have had no row to sit on
        const isKnown = get().chats.some(
          (chat) => chat._id === newMessage.senderId,
        );
        if (!isKnown) get().getMyChatPartners();
      }

      if (isSoundEnabled) {
        const notificationSound = new Audio("/sounds/notification.mp3");
        notificationSound.currentTime = 0;
        notificationSound
          .play()
          .catch((e) => console.log("Audio play failed: ", e));
      }
    });
  },

  removeMessageListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.off("newMessage");
    socket.off("messageDeleted");
    socket.off("messagesDelivered");
    socket.off("messagesRead");
  },
}));
