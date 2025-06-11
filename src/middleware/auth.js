const { verifyAccessToken } = require("../utils/jwt");
const User = require("../model/userModel");
const Admin = require("../model/adminModel");
const { createChildLogger } = require("../utils/logger");

const logger = createChildLogger("AuthMiddleware");

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      logger.warn("Access token missing in request", {
        ip: req.ip,
        path: req.path,
      });
      return res.status(401).json({
        success: false,
        message: "Access token required",
      });
    }

    const decoded = verifyAccessToken(token);
    req.user = decoded;

    logger.debug("Token authenticated successfully", {
      userId: decoded.id,
      role: decoded.role,
    });

    next();
  } catch (error) {
    logger.warn("Token authentication failed", error, {
      ip: req.ip,
      path: req.path,
    });
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

const authenticateUser = async (req, res, next) => {
  try {
    await authenticateToken(req, res, async () => {
      // ✅ ONLY allow users (employees) - NOT admins
      if (req.user.role !== "user") {
        logger.warn("Non-user attempting user access", {
          userId: req.user.id,
          role: req.user.role,
          ip: req.ip,
        });
        return res.status(403).json({
          success: false,
          message:
            "Employee access required - admins cannot access employee features",
        });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        logger.warn("User not found during authentication", {
          userId: req.user.id,
        });
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      req.currentUser = user;
      logger.debug("User authenticated successfully", { userId: user._id });
      next();
    });
  } catch (error) {
    logger.error("User authentication error", error, {
      userId: req.user?.id,
    });
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

const authenticateAdmin = async (req, res, next) => {
  try {
    await authenticateToken(req, res, async () => {
      // ✅ ONLY allow admins - NOT users
      if (req.user.role !== "admin") {
        logger.warn("Non-admin attempting admin access", {
          userId: req.user.id,
          role: req.user.role,
          ip: req.ip,
        });
        return res.status(403).json({
          success: false,
          message:
            "Admin access required - employees cannot access admin panel",
        });
      }

      const admin = await Admin.findById(req.user.id);
      if (!admin) {
        logger.warn("Admin not found during authentication", {
          adminId: req.user.id,
        });
        return res.status(404).json({
          success: false,
          message: "Admin not found",
        });
      }

      req.currentAdmin = admin;
      logger.debug("Admin authenticated successfully", { adminId: admin._id });
      next();
    });
  } catch (error) {
    logger.error("Admin authentication error", error, {
      adminId: req.user?.id,
    });
    return res.status(500).json({
      success: false,
      message: "Authentication error",
    });
  }
};

module.exports = {
  authenticateToken,
  authenticateUser,
  authenticateAdmin,
};
