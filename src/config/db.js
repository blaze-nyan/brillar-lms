require("dotenv").config();
const mongoose = require("mongoose");
const { createChildLogger } = require("../utils/logger");

const logger = createChildLogger("Database");
const url = process.env.MONGODB_URI || "mongodb://localhost:27017";

if (!url) {
  logger.error("MongoDB URI not defined in environment variables");
  throw new Error("Define the mongodb url in .env");
}

async function connect() {
  try {
    await mongoose.connect(url);
    const connection = mongoose.connection;

    connection.on("connected", () => {
      logger.info("MongoDB connected successfully", {
        uri: url.replace(/\/\/.*@/, "//***@"),
      });
    });

    connection.on("error", (err) => {
      logger.error("MongoDB connection error", err);
      process.exit(1);
    });

    connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    process.on("SIGINT", async () => {
      logger.info("Received SIGINT, closing MongoDB connection...");
      await connection.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("Failed to connect to MongoDB", error);
    throw error;
  }
}

module.exports = connect;
