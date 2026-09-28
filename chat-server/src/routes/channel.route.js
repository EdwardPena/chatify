import express from "express";
import {
  deleteChannel,
  deleteChannelMessage,
  getChannelMessages,
  sendChannelMessage,
  updateChannel,
} from "../controllers/channel.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.patch("/:id", updateChannel);
router.delete("/:id", deleteChannel);

router.get("/:id/messages", getChannelMessages);
router.post("/:id/messages", sendChannelMessage);
router.delete("/:id/messages/:messageId", deleteChannelMessage);

export default router;
