import { isSpoofedBot } from "@arcjet/inspect";
import aj from "../lib/arcjet.js";

export const arcjetProtection = async (req, res, next) => {
  try {
    const desicion = await aj.protect(req);
    if (desicion.isDenied()) {
      if (desicion.reason.isRateLimit()) {
        return res
          .status(429)
          .json({ message: "Rate limit exceeded. Try again later." });
      } else if (desicion.isBot()) {
        return res.status(403).json({ message: "Bot access denied" });
      } else {
        return res
          .status(403)
          .json({ message: "Access denied by security policy" });
      }
    }
    // Check for spoofed bots
    if (desicion.results.some(isSpoofedBot)) {
      return res.status(403).json({
        error: "Spoofed bot detected",
        message: "Spoofed bot access denied",
      });
    }
    next();
  } catch (error) {
    console.log("Arcjet protection error:", error);
    next();
  }
};
