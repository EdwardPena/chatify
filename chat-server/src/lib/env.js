import "dotenv/config";

export const ENV = {
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  NODE_ENV: process.env.NODE_ENV,
  JWT_SECRET: process.env.JWT_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FORM: process.env.EMAIL_FORM,
  EMAIL_FORM_NAME: process.env.EMAIL_FORM_NAME,
  CLIENT_URL: process.env.CLIENT_URL,
};
