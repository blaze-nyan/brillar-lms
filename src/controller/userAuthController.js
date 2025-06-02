const User = require("../model/userModel");
const { generateTokenPair, verifyRefreshToken } = require("../utils/jwt");
const { createChildLogger } = require("../utils/logger");

const logger = createChildLogger("UserAuth");

const registerUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phoneNumber,
      education,
      address,
      supervisor,
    } = req.body;

    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      logger.warn("User registration failed - email already exists", {
        email: email.toLowerCase().trim(),
      });
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const existingPhone = await User.findOne({ phoneNumber });
    if (existingPhone) {
      logger.warn("User registration failed - phone number already exists", {
        phoneNumber,
      });
      return res.status(400).json({
        success: false,
        message: "User already exists with this phone number",
      });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      phoneNumber,
      education: education.trim(),
      address: address.trim(),
      supervisor,
    });

    const savedUser = await user.save();

    await new Promise((resolve) => setTimeout(resolve, 100));

    logger.info("New user registered successfully", {
      userId: savedUser._id,
      email: savedUser.email,
      supervisor: savedUser.supervisor,
    });

    const tokenPayload = {
      id: savedUser._id,
      email: savedUser.email,
      role: "user",
    };
    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    await savedUser.addRefreshToken(refreshToken);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: {
        user: {
          id: savedUser._id,
          name: savedUser.name,
          email: savedUser.email,
          phoneNumber: savedUser.phoneNumber,
          education: savedUser.education,
          address: savedUser.address,
          supervisor: savedUser.supervisor,
          createdAt: savedUser.createdAt,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error("User registration error", error, {
      email: req.body?.email,
      ip: req.ip,
    });
    req.log.error("User registration failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    }).select("+password");
    if (!user) {
      logger.warn("User login failed - user not found", {
        email: email.toLowerCase().trim(),
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      logger.warn("User login failed - invalid password", {
        userId: user._id,
        email: user.email,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const tokenPayload = { id: user._id, email: user.email, role: "user" };
    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    await user.addRefreshToken(refreshToken);

    logger.info("User login successful", {
      userId: user._id,
      email: user.email,
    });

    req.log.info("User authenticated successfully", { userId: user._id });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          education: user.education,
          address: user.address,
          supervisor: user.supervisor,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error("User login error", error, {
      email: req.body?.email,
      ip: req.ip,
    });
    req.log.error("User login failed", error);
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

    const user = await User.findById(decoded.id);
    if (!user || !user.hasRefreshToken(refreshToken)) {
      logger.warn("Invalid refresh token attempt", {
        userId: decoded.id,
        ip: req.ip,
      });
      return res.status(403).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const tokenPayload = { id: user._id, email: user.email, role: "user" };
    const { accessToken, refreshToken: newRefreshToken } =
      generateTokenPair(tokenPayload);

    await user.removeRefreshToken(refreshToken);
    await user.addRefreshToken(newRefreshToken);

    logger.info("Token refreshed successfully", { userId: user._id });
    req.log.info("User token refreshed", { userId: user._id });

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

const logoutUser = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      logger.warn("User not found during logout", { userId });
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (refreshToken) {
      await user.removeRefreshToken(refreshToken);
      logger.info("User logged out from single device", { userId });
    } else {
      await user.removeAllRefreshTokens();
      logger.info("User logged out from all devices", { userId });
    }

    req.log.info("User logout successful", { userId });

    res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    logger.error("User logout error", error, {
      userId: req.user?.id,
      ip: req.ip,
    });
    req.log.error("User logout failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getUserProfile = async (req, res) => {
  try {
    const user = req.currentUser;

    await user.populate("leave");

    logger.info("User profile accessed", { userId: user._id });
    req.log.info("User profile retrieved", { userId: user._id });

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          education: user.education,
          address: user.address,
          supervisor: user.supervisor,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          leave: user.leave,
        },
      },
    });
  } catch (error) {
    logger.error("Get user profile error", error, {
      userId: req.currentUser?._id,
    });
    req.log.error("Get user profile failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phoneNumber, education, address } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (name) user.name = name.trim();
    if (phoneNumber) {
      const existingPhone = await User.findOne({
        phoneNumber,
        _id: { $ne: userId },
      });
      if (existingPhone) {
        return res.status(400).json({
          success: false,
          message: "Phone number already exists",
        });
      }
      user.phoneNumber = phoneNumber;
    }
    if (education) user.education = education.trim();
    if (address) user.address = address.trim();

    await user.save();

    logger.info("User profile updated", {
      userId: user._id,
      updatedFields: Object.keys(req.body),
    });

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          education: user.education,
          address: user.address,
          supervisor: user.supervisor,
          updatedAt: user.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error("Update user profile error", error, {
      userId: req.user?.id,
    });
    req.log.error("Update user profile failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
};
