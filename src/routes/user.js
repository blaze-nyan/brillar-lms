const express = require("express");
const router = express.Router();

const {
  registerUser,
  loginUser,
  refreshToken,
  logoutUser,
  getUserProfile,
  updateUserProfile,
} = require("../controller/userAuthController");

const {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getSupervisors,
} = require("../controller/userController");

const {
  validateUserRegistration,
  validateLogin,
} = require("../middleware/validation");
const { authenticateUser, authenticateAdmin } = require("../middleware/auth");

router.post("/register", validateUserRegistration, registerUser);
router.post("/login", validateLogin, loginUser);
router.post("/refresh", refreshToken);

router.get("/profile", authenticateUser, getUserProfile);
router.put("/profile", authenticateUser, updateUserProfile);
router.post("/logout", authenticateUser, logoutUser);

router.get("/admin/all", authenticateAdmin, getAllUsers);
router.get("/admin/:userId", authenticateAdmin, getUserById);
router.put("/admin/:userId", authenticateAdmin, updateUser);
router.delete("/admin/:userId", authenticateAdmin, deleteUser);

router.get("/supervisors", getSupervisors);

module.exports = router;
