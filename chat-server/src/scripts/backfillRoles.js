// run once after upgrading: node src/scripts/backfillRoles.js
import mongoose from "mongoose";
import { ENV } from "../lib/env.js";
import Server from "../models/Server.js";
import { ensureServerRoles } from "../lib/permissions.js";

// servers created before roles had a model of their own carry the role as a
// plain string on each member. The app repairs them lazily on first read, this
// does the whole database in one go.
const backfillRoles = async () => {
  await mongoose.connect(ENV.MONGODB_URI);

  const servers = await Server.find({});
  let repaired = 0;

  for (const server of servers) {
    const missing = server.members.filter((member) => !member.roleId).length;
    await ensureServerRoles(server);
    if (missing > 0) repaired += 1;
  }

  console.log(`Checked ${servers.length} server(s), repaired ${repaired}.`);
  await mongoose.disconnect();
};

backfillRoles().catch((error) => {
  console.log("Error backfilling roles: ", error.message);
  process.exit(1);
});
