import express from "express";
import {
  createRole,
  deleteRole,
  getServerRoles,
  updateRole,
} from "../controllers/role.controllers.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { arcjetProtection } from "../middleware/arcjet.middleware.js";

const router = express.Router({ mergeParams: true });

router.use(arcjetProtection, protectRoute);

router.get("/", getServerRoles);
router.post("/", createRole);
router.patch("/:roleId", updateRole);
router.delete("/:roleId", deleteRole);

export default router;
