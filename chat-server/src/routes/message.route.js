import express from "express";
import {
  getChatPartners,
  getMessagesByUserId,
  sendMessage,
} from "../controllers/message.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

// contacts now live under /api/contacts, they are no longer "every user"
router.get("/chats", getChatPartners);
router.get("/:id", getMessagesByUserId);
router.post("/send/:id", sendMessage);

export default router;
