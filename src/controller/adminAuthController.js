// const Admin = require("../models/Admin");
// const JWTService = require("../utils/jwt");
// const logger = require("../utils/logger");

// class AdminAuthController {
//   // Admin Login with Auto-Create Logic
//   static async login(req, res) {
//     try {
//       const { email, password } = req.body;

//       // Validate credentials against environment variables
//       const envAdminEmail = process.env.ADMIN_EMAIL;
//       const envAdminPassword = process.env.ADMIN_PASSWORD;

//       if (!envAdminEmail || !envAdminPassword) {
//         logger.error(
//           "Admin credentials not configured in environment variables"
//         );
//         return res.status(500).json({
//           success: false,
//           message: "Admin credentials not configured",
//         });
//       }

//       // Check if provided credentials match environment variables
//       if (email !== envAdminEmail || password !== envAdminPassword) {
//         logger.warn(`Failed admin login attempt with email: ${email}`);
//         return res.status(401).json({
//           success: false,
//           message: "Invalid admin credentials",
//         });
//       }

//       // Look for existing admin in database
//       let admin = await Admin.findOne({ email: envAdminEmail }).select(
//         "+password"
//       );

//       if (!admin) {
//         // Admin doesn't exist, create new one
//         logger.info(`Creating new admin user: ${envAdminEmail}`);

//         admin = new Admin({
//           email: envAdminEmail,
//           password: envAdminPassword, // Will be hashed by pre-save middleware
//           role: "admin",
//         });

//         await admin.save();
//         logger.info(`New admin created successfully: ${envAdminEmail}`);

//         // Reload admin without password for response
//         admin = await Admin.findById(admin._id);
//       } else {
//         // Admin exists, verify they're active
//         if (!admin.isActive) {
//           return res.status(401).json({
//             success: false,
//             message: "Admin account is inactive",
//           });
//         }

//         logger.info(`Existing admin logging in: ${envAdminEmail}`);
//       }

//       // Generate tokens
//       const tokenPayload = {
//         userId: admin._id,
//         email: admin.email,
//         role: admin.role,
//         type: "admin",
//       };
//       const tokens = JWTService.generateTokenPair(tokenPayload);

//       // Save refresh token to database
//       await admin.addRefreshToken(tokens.refreshToken);

//       // Update last login
//       admin.lastLogin = new Date();
//       await admin.save();

//       // Set refresh token as httpOnly cookie
//       res.cookie("adminRefreshToken", tokens.refreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === "production",
//         sameSite: "strict",
//         maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
//         path: "/api/admin",
//       });

//       logger.info(`Admin login successful: ${email}`);

//       res.json({
//         success: true,
//         message: "Admin login successful",
//         data: {
//           admin: {
//             id: admin._id,
//             email: admin.email,
//             role: admin.role,
//             lastLogin: admin.lastLogin,
//             isNewUser: !admin.lastLogin, // Indicates if this was first login
//           },
//           accessToken: tokens.accessToken,
//           expiresIn: tokens.accessTokenExpiresIn,
//         },
//       });
//     } catch (error) {
//       logger.error("Admin login error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//       });
//     }
//   }

//   // Admin Refresh Token
//   static async refreshToken(req, res) {
//     try {
//       const refreshToken =
//         req.cookies.adminRefreshToken || req.body.refreshToken;

//       if (!refreshToken) {
//         return res.status(401).json({
//           success: false,
//           message: "Admin refresh token required",
//         });
//       }

//       // Verify refresh token
//       const decoded = JWTService.verifyRefreshToken(refreshToken);

//       // Ensure this is an admin token
//       if (decoded.type !== "admin") {
//         return res.status(401).json({
//           success: false,
//           message: "Invalid admin token",
//         });
//       }

//       // Find admin and check if refresh token exists
//       const admin = await Admin.findById(decoded.userId);
//       if (!admin || !admin.isActive) {
//         return res.status(401).json({
//           success: false,
//           message: "Admin not found or inactive",
//         });
//       }

//       // Check if refresh token exists in database
//       const tokenExists = admin.hasRefreshToken(refreshToken);
//       if (!tokenExists) {
//         return res.status(401).json({
//           success: false,
//           message: "Invalid refresh token",
//         });
//       }

//       // Generate new tokens
//       const tokenPayload = {
//         userId: admin._id,
//         email: admin.email,
//         role: admin.role,
//         type: "admin",
//       };
//       const newTokens = JWTService.generateTokenPair(tokenPayload);

//       // Remove old refresh token and add new one
//       await admin.removeRefreshToken(refreshToken);
//       await admin.addRefreshToken(newTokens.refreshToken);

//       // Set new refresh token as cookie
//       res.cookie("adminRefreshToken", newTokens.refreshToken, {
//         httpOnly: true,
//         secure: process.env.NODE_ENV === "production",
//         sameSite: "strict",
//         maxAge: 7 * 24 * 60 * 60 * 1000,
//         path: "/api/admin",
//       });

//       logger.info(`Admin token refreshed: ${admin.email}`);

//       res.json({
//         success: true,
//         message: "Admin token refreshed successfully",
//         data: {
//           accessToken: newTokens.accessToken,
//           expiresIn: newTokens.accessTokenExpiresIn,
//         },
//       });
//     } catch (error) {
//       logger.error("Admin token refresh error:", error);

//       if (
//         error.message.includes("Invalid") ||
//         error.name === "TokenExpiredError"
//       ) {
//         return res.status(401).json({
//           success: false,
//           message: "Invalid or expired admin refresh token",
//         });
//       }

//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//       });
//     }
//   }

//   // Admin Logout
//   static async logout(req, res) {
//     try {
//       const refreshToken =
//         req.cookies.adminRefreshToken || req.body.refreshToken;

//       if (refreshToken) {
//         try {
//           const decoded = JWTService.verifyRefreshToken(refreshToken);
//           const admin = await Admin.findById(decoded.userId);

//           if (admin) {
//             await admin.removeRefreshToken(refreshToken);
//             logger.info(`Admin logged out: ${admin.email}`);
//           }
//         } catch (error) {
//           // Token might be expired or invalid, but still clear cookie
//           logger.warn(
//             "Admin logout - token verification failed:",
//             error.message
//           );
//         }
//       }

//       // Clear refresh token cookie
//       res.clearCookie("adminRefreshToken", { path: "/api/admin" });

//       res.json({
//         success: true,
//         message: "Admin logout successful",
//       });
//     } catch (error) {
//       logger.error("Admin logout error:", error);
//       // Still clear cookie even if there's an error
//       res.clearCookie("adminRefreshToken", { path: "/api/admin" });

//       res.json({
//         success: true,
//         message: "Admin logout successful",
//       });
//     }
//   }

//   // Admin Logout from all devices
//   static async logoutAll(req, res) {
//     try {
//       const admin = req.admin; // From admin auth middleware

//       await admin.removeAllRefreshTokens();
//       res.clearCookie("adminRefreshToken", { path: "/api/admin" });

//       logger.info(`Admin logged out from all devices: ${admin.email}`);

//       res.json({
//         success: true,
//         message: "Admin logged out from all devices successfully",
//       });
//     } catch (error) {
//       logger.error("Admin logout all error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//       });
//     }
//   }

//   // Get admin profile
//   static async getProfile(req, res) {
//     try {
//       const admin = req.admin; // From admin auth middleware

//       res.json({
//         success: true,
//         data: {
//           admin: {
//             id: admin._id,
//             email: admin.email,
//             role: admin.role,
//             lastLogin: admin.lastLogin,
//             createdAt: admin.createdAt,
//             updatedAt: admin.updatedAt,
//           },
//         },
//       });
//     } catch (error) {
//       logger.error("Get admin profile error:", error);
//       res.status(500).json({
//         success: false,
//         message: "Internal server error",
//       });
//     }
//   }

//   // Validate environment credentials (utility method)
//   static validateEnvCredentials() {
//     const envAdminEmail = process.env.ADMIN_EMAIL;
//     const envAdminPassword = process.env.ADMIN_PASSWORD;

//     if (!envAdminEmail || !envAdminPassword) {
//       logger.error(
//         "ADMIN_EMAIL and ADMIN_PASSWORD must be set in environment variables"
//       );
//       return false;
//     }

//     // Basic validation
//     const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
//     if (!emailRegex.test(envAdminEmail)) {
//       logger.error("Invalid ADMIN_EMAIL format in environment variables");
//       return false;
//     }

//     if (envAdminPassword.length < 6) {
//       logger.error("ADMIN_PASSWORD must be at least 6 characters long");
//       return false;
//     }

//     return true;
//   }
// }

// module.exports = AdminAuthController;
