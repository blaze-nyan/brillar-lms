const express = require("express");
const router = express.Router();
const {
  loginAdmin,
  refreshToken,
  logoutAdmin,
  getAdminProfile,
} = require("../controller/adminAuthController");
const { validateAdminLogin } = require("../middleware/validation");
const { authenticateAdmin } = require("../middleware/auth");

router.post("/login", validateAdminLogin, loginAdmin);
router.post("/refresh", refreshToken);
router.post("/logout", authenticateAdmin, logoutAdmin);
router.get("/profile", authenticateAdmin, getAdminProfile);

module.exports = router;
