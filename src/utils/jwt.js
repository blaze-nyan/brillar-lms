require("dotenv").config();
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";
const REFRESH_SECRET = process.env.REFRESH_SECRET || "your-refresh-secret";

const generateAccessToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: "7d" });
};

const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid access token");
  }
};

const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, REFRESH_SECRET);
  } catch (error) {
    throw new Error("Invalid refresh token");
  }
};

const generateTokenPair = (payload) => {
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);
  return { accessToken, refreshToken };
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
};
