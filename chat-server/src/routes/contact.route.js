import express from "express";
import {
  acceptContactRequest,
  cancelContactRequest,
  getContactRequests,
  getMyContacts,
  rejectContactRequest,
  removeContact,
  searchUsers,
  sendContactRequest,
} from "../controllers/contact.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router();

router.use(arcjetProtection, protectRoute);

router.get("/", getMyContacts);
router.get("/search", searchUsers);

router.get("/requests", getContactRequests);
router.post("/requests", sendContactRequest);
router.patch("/requests/:id/accept", acceptContactRequest);
router.patch("/requests/:id/reject", rejectContactRequest);
router.delete("/requests/:id", cancelContactRequest);

router.delete("/:id", removeContact);

export default router;
