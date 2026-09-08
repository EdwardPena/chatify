import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";

export const useContactStore = create((set, get) => ({
  contacts: [],
  incomingRequests: [],
  outgoingRequests: [],
  searchResults: [],
  isContactsLoading: false,
  isRequestsLoading: false,
  isSearching: false,
  isSendingRequest: false,

  getMyContacts: async () => {
    set({ isContactsLoading: true });
    try {
      const res = await axiosInstance.get("/contacts");
      set({ contacts: res.data.users });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isContactsLoading: false });
    }
  },

  getContactRequests: async () => {
    set({ isRequestsLoading: true });
    try {
      const res = await axiosInstance.get("/contacts/requests");
      set({
        incomingRequests: res.data.incoming,
        outgoingRequests: res.data.outgoing,
      });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isRequestsLoading: false });
    }
  },

  searchUsers: async (username) => {
    if (!username.trim()) return set({ searchResults: [] });

    set({ isSearching: true });
    try {
      const res = await axiosInstance.get("/contacts/search", {
        params: { username: username.trim() },
      });
      set({ searchResults: res.data.users });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  sendContactRequest: async (username) => {
    set({ isSendingRequest: true });
    try {
      const res = await axiosInstance.post("/contacts/requests", { username });
      toast.success(res.data.message);

      // the other side had already asked us, so this became an instant contact
      if (res.data.contact) {
        get().addContact(res.data.contact);
        set({
          incomingRequests: get().incomingRequests.filter(
            (request) => request.user._id !== res.data.contact._id,
          ),
        });
      }

      await get().getContactRequests();
      // refresh the badges on any user still shown in the search results
      const { searchResults } = get();
      if (searchResults.length > 0) await get().searchUsers(username);
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isSendingRequest: false });
    }
  },

  acceptContactRequest: async (requestId) => {
    try {
      const res = await axiosInstance.patch(
        `/contacts/requests/${requestId}/accept`,
      );
      get().addContact(res.data.contact);
      set({
        incomingRequests: get().incomingRequests.filter(
          (request) => request._id !== requestId,
        ),
      });
      toast.success(`@${res.data.contact.username} is now a contact`);
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  rejectContactRequest: async (requestId) => {
    try {
      await axiosInstance.patch(`/contacts/requests/${requestId}/reject`);
      set({
        incomingRequests: get().incomingRequests.filter(
          (request) => request._id !== requestId,
        ),
      });
      toast.success("Request rejected");
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  cancelContactRequest: async (requestId) => {
    try {
      await axiosInstance.delete(`/contacts/requests/${requestId}`);
      set({
        outgoingRequests: get().outgoingRequests.filter(
          (request) => request._id !== requestId,
        ),
      });
      toast.success("Request cancelled");
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  removeContact: async (userId) => {
    try {
      await axiosInstance.delete(`/contacts/${userId}`);
      get().dropContact(userId);
      toast.success("Contact removed");
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  // socket events can race getMyContacts, so never add the same contact twice
  addContact: (user) => {
    const { contacts } = get();
    if (contacts.some((c) => c._id === user._id)) return;
    set({ contacts: [...contacts, user] });
  },

  // drops a contact locally, used by both sides of a removal
  dropContact: (userId) => {
    set({ contacts: get().contacts.filter((c) => c._id !== userId) });

    // close the conversation if we were looking at it
    const { selectedUser, setSelectedUser } = useChatStore.getState();
    if (selectedUser?._id === userId) setSelectedUser(null);
  },

  initContactListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("contactRequest");
    socket.off("contactRequestAccepted");
    socket.off("contactRequestCancelled");
    socket.off("contactRemoved");

    socket.on("contactRequest", (request) => {
      set({
        incomingRequests: [
          { _id: request._id, createdAt: request.createdAt, user: request.sender },
          ...get().incomingRequests,
        ],
      });
      toast.success(`@${request.sender.username} wants to be your contact`);
    });

    socket.on("contactRequestAccepted", ({ user }) => {
      get().addContact(user);
      set({
        outgoingRequests: get().outgoingRequests.filter(
          (request) => request.user._id !== user._id,
        ),
      });
      toast.success(`@${user.username} accepted your contact request`);
    });

    socket.on("contactRequestCancelled", ({ requestId }) => {
      set({
        incomingRequests: get().incomingRequests.filter(
          (request) => request._id !== requestId,
        ),
      });
    });

    socket.on("contactRemoved", ({ userId }) => {
      get().dropContact(userId);
    });
  },

  removeContactListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("contactRequest");
    socket.off("contactRequestAccepted");
    socket.off("contactRequestCancelled");
    socket.off("contactRemoved");
  },
}));
