import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ userId }, ENV.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
    httpOnly: true, // preven XSS attacks: cross-site scripting attacks
    sameSite: "strict", // prevent CSRF attacks: cross-site request forgery attacks
    secure: ENV.NODE_ENV === "development" ? false : true, // set to true in production for HTTPS
  });

  return token;
};
