import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { useChatStore } from "./useChatStore";
import { useVoiceStore } from "./useVoiceStore";

export const CHANNEL_TYPES = {
  TEXT: "text",
  VOICE: "voice",
};

export const PERMISSIONS = {
  MANAGE_SERVER: "manageServer",
  MANAGE_CHANNELS: "manageChannels",
  MANAGE_MEMBERS: "manageMembers",
  MANAGE_ROLES: "manageRoles",
  MODERATE_MESSAGES: "moderateMessages",
};

// muting is a per-device preference, it never leaves this browser
const readMutedChannels = () => {
  try {
    return JSON.parse(localStorage.getItem("mutedChannels")) || {};
  } catch {
    return {};
  }
};

// the first text channel is where a server opens, the same way #general is
const firstTextChannel = (channels = []) =>
  channels.find((channel) => channel.type === CHANNEL_TYPES.TEXT) || null;

export const useServerStore = create((set, get) => ({
  servers: [],
  activeServer: null, // the full server: channels, role, invite code
  activeChannel: null,
  members: [],
  channelMessages: [],
  replyingTo: null, // the channel message the composer is answering
  isServersLoading: false,
  isServerLoading: false,
  isMessagesLoading: false,
  isCreatingServer: false,
  isCreatingChannel: false,
  mutedChannels: readMutedChannels(),
  // { [channelId]: { count, mentions } } for every channel not being read
  channelUnread: {},

  // wipes everything that belonged to the last person signed in here
  reset: () =>
    set({
      servers: [],
      activeServer: null,
      activeChannel: null,
      members: [],
      channelMessages: [],
      replyingTo: null,
      isServersLoading: false,
      isServerLoading: false,
      isMessagesLoading: false,
      isCreatingServer: false,
      isCreatingChannel: false,
      channelUnread: {},
    }),

  // true while the user is looking at a server instead of their direct messages
  isInServer: () => Boolean(get().activeServer),

  // the roles this server has, highest first, as the dialog lists them
  roles: () => get().activeServer?.roles || [],

  findChannel: (channelId) =>
    (get().activeServer?.channels || []).find(
      (channel) => channel._id === channelId,
    ) ||
    get()
      .servers.flatMap((server) => server.channels || [])
      .find((channel) => channel._id === channelId) ||
    null,

  findRole: (roleId) =>
    get().roles().find((role) => role._id === roleId) || null,

  // what a member outranks, so the UI hides what the api would refuse anyway
  myPosition: () =>
    get().activeServer?.isOwner
      ? Number.POSITIVE_INFINITY
      : (get().activeServer?.role?.position ?? -1),

  // a role level with yours is still yours to shape, the one you hold is not
  canManageRole: (role) => {
    const server = get().activeServer;
    if (!server || !role) return false;
    if (server.isOwner) return true;

    return (
      get().can(PERMISSIONS.MANAGE_ROLES) &&
      role.position <= get().myPosition() &&
      role._id !== server.role?._id
    );
  },

  canAssignRole: (role) => {
    const server = get().activeServer;
    if (!server || !role) return false;
    return server.isOwner || role.position <= get().myPosition();
  },

  // every privileged control asks this instead of checking the role itself
  can: (permission) =>
    Boolean(get().activeServer?.permissions?.includes(permission)),

  isMuted: (channelId) => Boolean(get().mutedChannels[channelId]),

  unreadFor: (channelId) => get().channelUnread[channelId] || null,

  // a muted channel keeps quiet about ordinary traffic, but being tagged by
  // name still gets through: that is the whole point of a mention
  badgeFor: (channelId) => {
    const unread = get().channelUnread[channelId];
    if (!unread) return null;
    if (get().isMuted(channelId)) {
      return unread.mentions > 0 ? { count: unread.mentions, isMention: true } : null;
    }
    return {
      count: unread.count,
      isMention: unread.mentions > 0,
    };
  },

  // what the server rail shows on its icons: summed from the unread tally
  // itself, since the rail knows nothing about channels it has never opened
  serverBadge: (serverId) => {
    return Object.keys(get().channelUnread).reduce(
      (total, channelId) => {
        if (get().channelUnread[channelId].serverId !== serverId) return total;

        const badge = get().badgeFor(channelId);
        if (!badge) return total;

        return {
          count: total.count + badge.count,
          isMention: total.isMention || badge.isMention,
        };
      },
      { count: 0, isMention: false },
    );
  },

  clearUnread: (channelId) => {
    if (!get().channelUnread[channelId]) return;

    const next = { ...get().channelUnread };
    delete next[channelId];
    set({ channelUnread: next });
  },

  toggleMuteChannel: (channelId) => {
    const muted = { ...get().mutedChannels };
    if (muted[channelId]) delete muted[channelId];
    else muted[channelId] = true;

    localStorage.setItem("mutedChannels", JSON.stringify(muted));
    set({ mutedChannels: muted });
  },

  createRole: async ({ name, color, permissions }) => {
    const { activeServer } = get();
    if (!activeServer) return false;

    try {
      const res = await axiosInstance.post(
        `/servers/${activeServer._id}/roles`,
        { name, color, permissions },
      );
      toast.success(`${res.data.role.name} created`);
      return true;
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
      return false;
    }
  },

  // the socket event carries the whole table back, this only covers the wait
  updateRole: async (roleId, changes) => {
    const { activeServer } = get();
    if (!activeServer) return;

    const previous = activeServer.roles;
    set({
      activeServer: {
        ...activeServer,
        roles: previous.map((role) =>
          role._id === roleId ? { ...role, ...changes } : role,
        ),
      },
    });

    try {
      await axiosInstance.patch(
        `/servers/${activeServer._id}/roles/${roleId}`,
        changes,
      );
    } catch (error) {
      set({ activeServer: { ...get().activeServer, roles: previous } });
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  deleteRole: async (roleId) => {
    const { activeServer } = get();
    if (!activeServer) return;

    try {
      const res = await axiosInstance.delete(
        `/servers/${activeServer._id}/roles/${roleId}`,
      );
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  updateMemberRole: async (userId, roleId) => {
    const { activeServer } = get();
    if (!activeServer) return;

    try {
      const res = await axiosInstance.patch(
        `/servers/${activeServer._id}/members/${userId}`,
        { roleId },
      );
      // the socket event updates the list, this only covers a missed round trip
      set({
        members: get().members.map((m) =>
          m._id === userId ? { ...m, roleId } : m,
        ),
      });
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  removeMember: async (userId) => {
    const { activeServer } = get();
    if (!activeServer) return;

    try {
      await axiosInstance.delete(
        `/servers/${activeServer._id}/members/${userId}`,
      );
      set({ members: get().members.filter((m) => m._id !== userId) });
      toast.success("Member removed");
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  deleteChannelMessage: async (messageId) => {
    const { activeChannel } = get();
    if (!activeChannel) return;

    try {
      await axiosInstance.delete(
        `/channels/${activeChannel._id}/messages/${messageId}`,
      );
      set({
        channelMessages: get().channelMessages.filter((m) => m._id !== messageId),
      });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  searchChannelMessages: async (term) => {
    const { activeChannel } = get();
    if (!activeChannel || !term.trim()) return [];

    try {
      const res = await axiosInstance.get(
        `/channels/${activeChannel._id}/messages`,
        { params: { search: term.trim() } },
      );
      return res.data;
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
      return [];
    }
  },

  getMyServers: async () => {
    set({ isServersLoading: true });
    try {
      const res = await axiosInstance.get("/servers");
      set({ servers: res.data.servers });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isServersLoading: false });
    }
  },

  selectServer: async (serverId) => {
    // leaving for the direct messages view, nothing to load
    if (!serverId) {
      set({ activeServer: null, activeChannel: null, channelMessages: [], members: [] });
      return;
    }
    if (get().activeServer?._id === serverId) return;

    set({ isServerLoading: true, activeChannel: null, channelMessages: [] });
    try {
      const res = await axiosInstance.get(`/servers/${serverId}`);
      set({ activeServer: res.data });

      const channel = firstTextChannel(res.data.channels);
      if (channel) get().selectChannel(channel);

      get().getMembers(serverId);
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isServerLoading: false });
    }
  },

  getMembers: async (serverId) => {
    try {
      const res = await axiosInstance.get(`/servers/${serverId}/members`);
      set({ members: res.data.members });
    } catch (error) {
      console.log("Error loading members: ", error);
    }
  },

  createServer: async (data) => {
    set({ isCreatingServer: true });
    try {
      const res = await axiosInstance.post("/servers", data);
      set({ servers: [...get().servers, res.data], activeServer: res.data });

      const channel = firstTextChannel(res.data.channels);
      if (channel) get().selectChannel(channel);

      get().getMembers(res.data._id);
      toast.success(`${res.data.name} is ready`);
      return true;
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
      return false;
    } finally {
      set({ isCreatingServer: false });
    }
  },

  joinServer: async (inviteCode) => {
    set({ isCreatingServer: true });
    try {
      const res = await axiosInstance.post("/servers/join", { inviteCode });
      set({
        servers: [...get().servers, res.data],
        activeServer: res.data,
      });

      const channel = firstTextChannel(res.data.channels);
      if (channel) get().selectChannel(channel);

      get().getMembers(res.data._id);
      toast.success(`Welcome to ${res.data.name}`);
      return true;
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
      return false;
    } finally {
      set({ isCreatingServer: false });
    }
  },

  leaveServer: async (serverId) => {
    try {
      const res = await axiosInstance.delete(`/servers/${serverId}/leave`);
      get().dropServer(serverId);
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  deleteServer: async (serverId) => {
    try {
      await axiosInstance.delete(`/servers/${serverId}`);
      get().dropServer(serverId);
      toast.success("Server deleted");
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  resetInviteCode: async (serverId) => {
    try {
      const res = await axiosInstance.post(`/servers/${serverId}/invite`);
      set({
        activeServer: { ...get().activeServer, inviteCode: res.data.inviteCode },
      });
      toast.success("New invite code generated");
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  createChannel: async ({ name, type, topic }) => {
    const { activeServer } = get();
    if (!activeServer) return false;

    set({ isCreatingChannel: true });
    try {
      const res = await axiosInstance.post(
        `/servers/${activeServer._id}/channels`,
        { name, type, topic },
      );

      // the socket event also lands here, addChannel keeps it to one copy
      get().addChannel(res.data.channel);
      get().selectChannel(res.data.channel);
      toast.success(`${res.data.channel.name} created`);
      return true;
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
      return false;
    } finally {
      set({ isCreatingChannel: false });
    }
  },

  deleteChannel: async (channelId) => {
    try {
      const res = await axiosInstance.delete(`/channels/${channelId}`);
      get().dropChannel(channelId);
      toast.success(res.data.message);
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  setReplyingTo: (message) => set({ replyingTo: message }),

  selectChannel: (channel) => {
    if (!channel) return set({ activeChannel: null, channelMessages: [] });

    // a voice channel opens its own stage, so you can see who is in the call,
    // and joins you to it
    if (channel.type === CHANNEL_TYPES.VOICE) {
      set({ activeChannel: channel, channelMessages: [], replyingTo: null });
      useVoiceStore.getState().joinVoiceChannel(channel);
      return;
    }

    set({ activeChannel: channel, channelMessages: [], replyingTo: null });
    // reading a channel is what marks it read
    get().clearUnread(channel._id);
    get().getChannelMessages(channel._id);
  },

  getChannelMessages: async (channelId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/channels/${channelId}/messages`);
      // a slow request must not overwrite a channel the user already left
      if (get().activeChannel?._id !== channelId) return;
      set({ channelMessages: res.data });
    } catch (error) {
      toast.error(error.response?.data.message || "Something went wrong");
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendChannelMessage: async (messageData) => {
    const { activeChannel, replyingTo } = get();
    const { authUser } = useAuthStore.getState();
    if (!activeChannel) return;

    const tempId = `temp-${Date.now()}`;

    const optimisticMessage = {
      _id: tempId,
      channelId: activeChannel._id,
      senderId: {
        _id: authUser._id,
        fullName: authUser.fullName,
        username: authUser.username,
        profilePic: authUser.profilePic,
      },
      text: messageData.text,
      image: messageData.image,
      // the base64 data url plays fine locally while the upload is in flight
      audio: messageData.audio,
      audioDuration: messageData.audioDuration,
      replyTo: replyingTo,
      createdAt: new Date().toISOString(),
      isOptimistic: true,
    };

    set({
      channelMessages: [...get().channelMessages, optimisticMessage],
      replyingTo: null,
    });

    try {
      const res = await axiosInstance.post(
        `/channels/${activeChannel._id}/messages`,
        { ...messageData, replyTo: replyingTo?._id },
      );
      set({
        channelMessages: get().channelMessages.map((msg) =>
          msg._id === tempId ? res.data : msg,
        ),
      });
    } catch (error) {
      set({
        channelMessages: get().channelMessages.filter(
          (msg) => msg._id !== tempId,
        ),
      });
      toast.error(error.response?.data.message || "Something went wrong");
    }
  },

  // socket events can race the request that already added it, never duplicate
  addChannel: (channel) => {
    const { activeServer } = get();
    if (!activeServer || activeServer._id !== channel.serverId) return;
    if (activeServer.channels.some((c) => c._id === channel._id)) return;

    set({
      activeServer: {
        ...activeServer,
        channels: [...activeServer.channels, channel],
      },
    });
  },

  dropChannel: (channelId) => {
    const { activeServer, activeChannel } = get();
    if (!activeServer) return;

    // hang up if the channel we are talking in is the one being removed
    if (useVoiceStore.getState().activeVoiceChannel?._id === channelId) {
      useVoiceStore.getState().leaveVoiceChannel();
    }

    const channels = activeServer.channels.filter((c) => c._id !== channelId);
    set({ activeServer: { ...activeServer, channels } });

    // fall back to another channel if the open one just disappeared
    if (activeChannel?._id === channelId) {
      const next = firstTextChannel(channels);
      if (next) get().selectChannel(next);
      else set({ activeChannel: null, channelMessages: [] });
    }
  },

  dropServer: (serverId) => {
    set({ servers: get().servers.filter((s) => s._id !== serverId) });
    if (get().activeServer?._id === serverId) {
      set({ activeServer: null, activeChannel: null, channelMessages: [], members: [] });
    }
  },

  // voice presence arrives for every channel of every server we are in
  setVoiceParticipants: (channelId, participants) => {
    const { activeServer } = get();
    if (!activeServer) return;

    set({
      activeServer: {
        ...activeServer,
        channels: activeServer.channels.map((channel) =>
          channel._id === channelId ? { ...channel, participants } : channel,
        ),
      },
    });
  },

  initServerListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    get().removeServerListener();

    socket.on("newChannelMessage", (message) => {
      // our own message is already on screen as the optimistic copy
      const { authUser } = useAuthStore.getState();
      if (message.senderId?._id === authUser?._id) return;

      const isReading = get().activeChannel?._id === message.channelId;
      const tagsMe = (message.mentions || []).some(
        (user) => user._id === authUser?._id,
      );

      if (isReading) {
        set({ channelMessages: [...get().channelMessages, message] });
      } else {
        // every other channel keeps a tally until it is opened
        const unread = get().channelUnread[message.channelId] || {
          count: 0,
          mentions: 0,
        };
        set({
          channelUnread: {
            ...get().channelUnread,
            [message.channelId]: {
              serverId: message.serverId,
              count: unread.count + 1,
              mentions: unread.mentions + (tagsMe ? 1 : 0),
            },
          },
        });
      }

      // muting silences the room, being named in it still rings
      const silenced = get().isMuted(message.channelId) && !tagsMe;
      if (useChatStore.getState().isSoundEnabled && !silenced) {
        const notificationSound = new Audio("/sounds/notification.mp3");
        notificationSound.currentTime = 0;
        notificationSound
          .play()
          .catch((e) => console.log("Audio play failed: ", e));
      }

      if (tagsMe && !isReading) {
        toast(`${message.senderId?.fullName} mentioned you in #${
          get().findChannel(message.channelId)?.name ?? "a channel"
        }`);
      }
    });

    socket.on("channelCreated", ({ channel }) => get().addChannel(channel));

    socket.on("channelUpdated", ({ channel }) => {
      const { activeServer, activeChannel } = get();
      if (!activeServer || activeServer._id !== channel.serverId) return;

      set({
        activeServer: {
          ...activeServer,
          channels: activeServer.channels.map((c) =>
            c._id === channel._id ? { ...c, ...channel } : c,
          ),
        },
        activeChannel:
          activeChannel?._id === channel._id
            ? { ...activeChannel, ...channel }
            : activeChannel,
      });
    });

    socket.on("channelDeleted", ({ channelId }) => get().dropChannel(channelId));

    socket.on("serverUpdated", ({ serverId, name, icon }) => {
      set({
        servers: get().servers.map((server) =>
          server._id === serverId ? { ...server, name, icon } : server,
        ),
      });
      if (get().activeServer?._id === serverId) {
        set({ activeServer: { ...get().activeServer, name, icon } });
      }
    });

    socket.on("serverDeleted", ({ serverId }) => {
      get().dropServer(serverId);
      toast("A server you were in was deleted");
    });

    socket.on("serverMemberJoined", ({ serverId, member }) => {
      if (get().activeServer?._id !== serverId) return;
      if (get().members.some((m) => m._id === member._id)) return;
      set({ members: [...get().members, member] });
    });

    socket.on("serverMemberLeft", ({ serverId, userId }) => {
      if (get().activeServer?._id !== serverId) return;
      set({ members: get().members.filter((m) => m._id !== userId) });
    });

    socket.on(
      "serverMemberRoleChanged",
      ({ serverId, userId, roleId, permissions }) => {
        const { activeServer } = get();
        if (activeServer?._id !== serverId) return;

        set({
          members: get().members.map((m) =>
            m._id === userId ? { ...m, roleId } : m,
          ),
        });

        // it may be our own promotion, which unlocks the matching controls
        const { authUser } = useAuthStore.getState();
        if (authUser?._id === userId) {
          const role = activeServer.roles.find((r) => r._id === roleId);
          set({
            activeServer: {
              ...get().activeServer,
              role: role || activeServer.role,
              permissions: activeServer.isOwner
                ? activeServer.permissions
                : permissions,
            },
          });
          toast.success(`You are now ${role?.name || "reassigned"} in this server`);
        }
      },
    );

    socket.on("serverRolesUpdated", ({ serverId, roles }) => {
      const { activeServer } = get();
      if (activeServer?._id !== serverId) return;

      // our own buttons follow whatever our role is now allowed to do
      const mine = roles.find((role) => role._id === activeServer.role?._id);
      set({
        activeServer: {
          ...activeServer,
          roles,
          role: mine || activeServer.role,
          permissions: activeServer.isOwner
            ? activeServer.permissions
            : mine?.permissions || [],
        },
      });
    });

    // a deleted role handed its members back to the default one
    socket.on("serverMembersReassigned", ({ serverId, fromRoleId, toRoleId }) => {
      const { activeServer } = get();
      if (activeServer?._id !== serverId) return;

      set({
        members: get().members.map((m) =>
          m.roleId === fromRoleId ? { ...m, roleId: toRoleId } : m,
        ),
      });

      if (activeServer.role?._id === fromRoleId) {
        const fallback = activeServer.roles.find((r) => r._id === toRoleId);
        set({
          activeServer: {
            ...get().activeServer,
            role: fallback || null,
            permissions: activeServer.isOwner
              ? activeServer.permissions
              : fallback?.permissions || [],
          },
        });
      }
    });

    socket.on("channelMessageDeleted", ({ channelId, messageId }) => {
      if (get().activeChannel?._id !== channelId) return;
      set({
        channelMessages: get().channelMessages.filter(
          (m) => m._id !== messageId,
        ),
      });
    });

    // someone with the right to manage members just removed us
    socket.on("serverRemoved", ({ serverId, serverName }) => {
      get().dropServer(serverId);
      toast.error(`You were removed from ${serverName}`);
    });

    socket.on("voice:participants", ({ channelId, participants }) => {
      get().setVoiceParticipants(channelId, participants);
    });
  },

  removeServerListener: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    [
      "newChannelMessage",
      "channelCreated",
      "channelUpdated",
      "channelDeleted",
      "serverUpdated",
      "serverDeleted",
      "serverMemberJoined",
      "serverMemberLeft",
      "serverMemberRoleChanged",
      "channelMessageDeleted",
      "serverRolesUpdated",
      "serverMembersReassigned",
      "serverRemoved",
      "voice:participants",
    ].forEach((event) => socket.off(event));
  },
}));
