import express from "express";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import path from "path";
import { connectDB } from "./lib/db.js";
import { ENV } from "./lib/env.js";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();
const __dirname = path.resolve();

const PORT = ENV.PORT || 3000;

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(cors({ origin: ENV.CLIENT_URL, credentials: true }));

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// make ready for deployment

if (ENV.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../chat-client/dist")));

  app.get("/{*splat}", (req, res) => {
    res.sendFile(path.join(__dirname, "../chat-client/dist/index.html"));
  });
}

app.listen(PORT, () => {
  console.log("Server running on port: " + PORT);
  connectDB(); // Call the connectDB function to establish a database connection
});
