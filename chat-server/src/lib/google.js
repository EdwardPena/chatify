import { OAuth2Client } from "google-auth-library";
import { ENV } from "./env.js";

const client = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

// throws unless google signed this token for our app, so whatever it returns
// can be trusted
export const verifyGoogleToken = async (credential) => {
  const ticket = await client.verifyIdToken({
    idToken: credential,
    audience: ENV.GOOGLE_CLIENT_ID,
  });

  return ticket.getPayload();
};
