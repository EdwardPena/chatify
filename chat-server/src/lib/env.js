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
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  ARCJET_KEY: process.env.ARCJET_KEY,
  ARCJET_ENV: process.env.ARCJET_ENV,
};
