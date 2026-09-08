// run once before starting the server: node src/scripts/backfillUsernames.js
// username is required and unique, so old users need one before the index builds
import mongoose from "mongoose";
import { ENV } from "../lib/env.js";
import User from "../models/User.js";

const toHandle = (email) => {
  const base = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20);

  return base.length >= 3 ? base : `${base}user`.slice(0, 20);
};

const backfillUsernames = async () => {
  try {
    await mongoose.connect(ENV.MONGODB_URI);
    console.log("MongoDB connected");

    // go through the driver so the required rule doesn't hide these docs
    const users = mongoose.connection.collection("users");
    const pending = await users
      .find({ $or: [{ username: { $exists: false } }, { username: null }] })
      .toArray();

    console.log(`${pending.length} user(s) need a username`);

    const taken = new Set((await users.distinct("username")).filter(Boolean));

    for (const user of pending) {
      const base = toHandle(user.email || `user${user._id}`);
      let handle = base;
      let counter = 1;

      while (taken.has(handle)) {
        const suffix = String(++counter);
        handle = `${base.slice(0, 20 - suffix.length)}${suffix}`;
      }

      taken.add(handle);
      await users.updateOne({ _id: user._id }, { $set: { username: handle } });
      console.log(`${user.email} -> @${handle}`);
    }

    await User.syncIndexes();
    console.log("Indexes synced");

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error occurred while backfilling usernames:", error);
    process.exit(1);
  }
};

backfillUsernames();
