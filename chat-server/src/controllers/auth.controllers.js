import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { generateToken } from "../lib/utils.js";
import {
  sendPasswordResetEmail,
  sendWelcomeEmail,
} from "../emails/emailHandlers.js";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
import { verifyGoogleToken } from "../lib/google.js";

const RESET_TOKEN_MINUTES = 15;


const hashResetToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const generateUsername = async (email) => {
  const localPart = email
    .split("@")[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 15);

  // pad in case the email leaves us short of the 3 characters we require
  const base = (localPart || "user").padEnd(3, "0");

  let username = base;
  let suffix = 1;

  while (await User.exists({ username })) {
    username = `${base}${suffix}`;
    suffix += 1;
  }

  return username;
};

export const signup = async (req, res) => {
  // res.send("Signup endpoint");
  const { fullName, email, password } = req.body;
  const username = (req.body.username || "").trim().toLowerCase();

  try {
    if (!fullName || !email || !password || !username) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }
    // check if emailis valid: regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }
    // usernames are how other people find you, keep them short and mentionable
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return res.status(400).json({
        message:
          "Username must be 3-20 characters, using letters, numbers or underscores",
      });
    }

    const user = await User.findOne({ email });

    if (user) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const usernameTaken = await User.exists({ username });

    if (usernameTaken) {
      return res.status(400).json({ message: "Username already taken" });
    }

    // 123456 => $askldjasdkla_akldjaklsjd?>.,fsdf

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      fullName,
      email,
      username,
      password: hashedPassword,
    });

    if (newUser) {
      // generateToken(newUser._id, res);
      // await newUser.save();

      const savedUser = await newUser.save();
      generateToken(savedUser._id, res);

      res.status(201).json({
        _id: newUser._id,
        fullName: newUser.fullName,
        username: newUser.username,
        email: newUser.email,
        profilePic: newUser.profilePic,
      });

      try {
        await sendWelcomeEmail(
          savedUser.email,
          savedUser.fullName,
          ENV.CLIENT_URL,
        );
      } catch (error) {
        console.error("Error sending welcome email:", error);
      }
    } else {
      res.status(400).json({ message: "Invalid user data" });
    }
  } catch (error) {
    // the unique index rejected an email or username that was claimed between
    // our check above and the save
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] === "username"
        ? "Username"
        : "Email";
      return res.status(400).json({ message: `${field} already taken` });
    }
    console.error("Error occurred while signing up:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username: username.trim().toLowerCase() });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" }); // never tell the client if the email or password is incorrect for security reasons
    }

    if (!user.password) {
      return res
        .status(400)
        .json({ message: "This account uses Google sign in" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);

    if (!isPasswordCorrect) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Error occurred while logging in:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const googleLogin = async (req, res) => {
  const { credential } = req.body;

  try {
    if (!credential) {
      return res.status(400).json({ message: "Google credential is required" });
    }

    let payload;

    try {
      payload = await verifyGoogleToken(credential);
    } catch (error) {
      console.error("Invalid Google credential:", error.message);
      return res.status(401).json({ message: "Invalid Google credential" });
    }

    const { sub: googleId, email, email_verified, name, picture } = payload;

    if (!email || !email_verified) {
      return res
        .status(401)
        .json({ message: "Your Google email is not verified" });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    const isNewUser = !user;

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.profilePic && picture) user.profilePic = picture;
        await user.save();
      }
    } else {
      user = await User.create({
        googleId,
        email,
        fullName: name || email.split("@")[0],
        username: await generateUsername(email),
        profilePic: picture || "",
      });
    }

    generateToken(user._id, res);

    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      profilePic: user.profilePic,
    });

    if (isNewUser) {
      try {
        await sendWelcomeEmail(user.email, user.fullName, ENV.CLIENT_URL);
      } catch (error) {
        console.error("Error sending welcome email:", error);
      }
    }
  } catch (error) {
    console.error("Error occurred while signing in with Google:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const logout = (_, res) => {
  res.cookie("jwt", "", { maxAge: 0 });
  res.status(200).json({ message: "Logged out successfully" });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }


    const genericMessage =
      "If that email has an account, we just sent a reset link.";

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: genericMessage });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = hashResetToken(resetToken);
    user.resetPasswordExpiresAt = Date.now() + RESET_TOKEN_MINUTES * 60 * 1000;
    await user.save();

    try {
      await sendPasswordResetEmail(
        user.email,
        user.fullName,
        `${ENV.CLIENT_URL}/reset-password/${resetToken}`,
        RESET_TOKEN_MINUTES,
      );
    } catch (error) {
      // the token is useless if the email never arrived, do not leave it behind
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiresAt = undefined;
      await user.save();

      console.error("Error sending password reset email:", error);
      return res
        .status(502)
        .json({ message: "Could not send the reset email. Please try again." });
    }

    res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error("Error occurred while requesting a password reset:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    if (!password) {
      return res.status(400).json({ message: "A new password is required" });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    // an expired token stops matching here, so it fails like a wrong one
    const user = await User.findOne({
      resetPasswordToken: hashResetToken(token),
      resetPasswordExpiresAt: { $gt: Date.now() },
    });

    if (!user) {
      return res
        .status(400)
        .json({ message: "This reset link is invalid or has expired" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);

    // clearing the token is what makes the link single use
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    await user.save();

    res.status(200).json({ message: "Password updated. You can log in now." });
  } catch (error) {
    console.error("Error occurred while resetting the password:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { profilePic } = req.body;
    if (!profilePic) {
      return res.status(400).json({ message: "Profile picture is required" });
    }
    const userId = req.user._id;

    const uploadResponse = await cloudinary.uploader.upload(profilePic);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        profilePic: uploadResponse.secure_url,
      },
      { new: true },
    );
    res
      .status(200)
      .json({ message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error occurred while updating profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};
