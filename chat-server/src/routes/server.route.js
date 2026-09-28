import express from "express";
import {
  createChannel,
  createServer,
  deleteServer,
  getMyServers,
  getServerById,
  getServerMembers,
  joinServer,
  leaveServer,
  regenerateInviteCode,
  removeMember,
  updateMemberRole,
  updateServer,
} from "../controllers/server.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";
import roleRoutes from "./role.route.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/", getMyServers);
router.post("/", createServer);
router.post("/join", joinServer);

router.get("/:id", getServerById);
router.patch("/:id", updateServer);
router.delete("/:id", deleteServer);

router.delete("/:id/leave", leaveServer);
router.post("/:id/invite", regenerateInviteCode);

// creating and shaping roles is a domain of its own
router.use("/:id/roles", roleRoutes);

router.get("/:id/members", getServerMembers);
router.patch("/:id/members/:userId", updateMemberRole);
router.delete("/:id/members/:userId", removeMember);

// channels are created through their server, gated by manageChannels
router.post("/:id/channels", createChannel);

export default router;
