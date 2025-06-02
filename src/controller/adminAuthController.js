const Admin = require("../model/adminModel");
const { generateTokenPair, verifyRefreshToken } = require("../utils/jwt");
const { createChildLogger } = require("../utils/logger");

const logger = createChildLogger("AdminAuth");

const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      logger.error("Admin credentials not configured in environment variables");
      return res.status(500).json({
        success: false,
        message: "Admin credentials not configured",
      });
    }
    if (
      email.toLowerCase().trim() !== ADMIN_EMAIL.toLowerCase() ||
      password !== ADMIN_PASSWORD
    ) {
      logger.warn("Failed admin login attempt", {
        email: email.toLowerCase().trim(),
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    let admin = await Admin.findOne({ email: ADMIN_EMAIL.toLowerCase() });

    if (!admin) {
      admin = new Admin({
        name: "Brillar LMS Admin",
        email: ADMIN_EMAIL.toLowerCase(),
        password: ADMIN_PASSWORD,
      });
      await admin.save();
      logger.info("New admin account created", {
        adminId: admin._id,
        email: admin.email,
      });
    } else {
      admin.lastLogin = new Date();
      await admin.save();
      logger.info("Admin login successful", {
        adminId: admin._id,
        email: admin.email,
      });
    }

    const tokenPayload = { id: admin._id, email: admin.email, role: "admin" };
    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    await admin.addRefreshToken(refreshToken);

    req.log.info("Admin authenticated successfully", { adminId: admin._id });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          lastLogin: admin.lastLogin,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error("Admin login error", error, {
      email: req.body?.email,
      ip: req.ip,
    });
    req.log.error("Admin login failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      logger.warn("Refresh token missing in request");
      return res.status(401).json({
        success: false,
        message: "Refresh token required",
      });
    }

    const decoded = verifyRefreshToken(refreshToken);

    const admin = await Admin.findById(decoded.id);
    if (!admin || !admin.hasRefreshToken(refreshToken)) {
      logger.warn("Invalid refresh token attempt", {
        adminId: decoded.id,
        ip: req.ip,
      });
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const tokenPayload = { id: admin._id, email: admin.email, role: "admin" };
    const { accessToken, refreshToken: newRefreshToken } =
      generateTokenPair(tokenPayload);

    await admin.removeRefreshToken(refreshToken);
    await admin.addRefreshToken(newRefreshToken);

    logger.info("Token refreshed successfully", { adminId: admin._id });
    req.log.info("Admin token refreshed", { adminId: admin._id });

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error) {
    logger.error("Token refresh error", error, { ip: req.ip });
    req.log.error("Token refresh failed", error);
    res.status(403).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

const logoutAdmin = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const adminId = req.user.id;

    const admin = await Admin.findById(adminId);
    if (!admin) {
      logger.warn("Admin not found during logout", { adminId });
      return res.status(404).json({
        success: false,
        message: "Admin not found",
      });
    }

    if (refreshToken) {
      await admin.removeRefreshToken(refreshToken);
      logger.info("Admin logged out from single device", { adminId });
    } else {
      await admin.removeAllRefreshTokens();
      logger.info("Admin logged out from all devices", { adminId });
    }

    req.log.info("Admin logout successful", { adminId });

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("Admin logout error", error, {
      adminId: req.user?.id,
      ip: req.ip,
    });
    req.log.error("Admin logout failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const admin = req.currentAdmin;

    logger.info("Admin profile accessed", { adminId: admin._id });
    req.log.info("Admin profile retrieved", { adminId: admin._id });

    res.status(200).json({
      success: true,
      data: {
        admin: {
          id: admin._id,
          name: admin.name,
          email: admin.email,
          lastLogin: admin.lastLogin,
          createdAt: admin.createdAt,
          updatedAt: admin.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error("Get admin profile error", error, {
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Get admin profile failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  loginAdmin,
  refreshToken,
  logoutAdmin,
  getAdminProfile,
};
