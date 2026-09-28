import express from "express";
import {
  deleteMessage,
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
} from "../controllers/message.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/chats", getChatPartners);
router.get("/:id", getMessagesByUserId);
router.post("/send/:id", sendMessage);
router.delete("/:messageId", deleteMessage);

export default router;
