import { resendClient, sender } from "../lib/resend.js";
import {
  createPasswordResetEmailTemplate,
  createWelcomeEmailTemplate,
} from "../emails/emailTemplates.js";

export const sendWelcomeEmail = async (email, name, clientURL) => {
  const { data, error } = await resendClient.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: email,
    subject: "Welcome to QuickChat!",
    html: createWelcomeEmailTemplate(name, clientURL),
  });

  if (error) {
    console.error("Error sending welcome email:", error);
    throw new Error("Failed to send welcome email");
  }

  console.log("Welcome Email sent successfully", data);
};

export const sendPasswordResetEmail = async (email, name, resetURL, minutes) => {
  const { data, error } = await resendClient.emails.send({
    from: `${sender.name} <${sender.email}>`,
    to: email,
    subject: "Reset your QuickChat password",
    html: createPasswordResetEmailTemplate(name, resetURL, minutes),
  });

  if (error) {
    console.error("Error sending password reset email:", error);
    throw new Error("Failed to send password reset email");
  }

  console.log("Password reset email sent successfully", data);
};
