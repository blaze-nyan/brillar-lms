const express = require("express");
const router = express.Router();

const {
  getLeaveBalance,
  requestLeave,
  getAllLeaveBalances,
  resetLeaveBalance,
  adjustLeaveBalance,
  getLeaveStatistics,
  getLeaveHistory,
  cancelLeaveRequest,
} = require("../controller/leaveController");

const {
  validateLeaveRequest,
  validatePagination,
} = require("../middleware/validation");
const { authenticateUser, authenticateAdmin } = require("../middleware/auth");

// User routes
router.get("/balance", authenticateUser, getLeaveBalance);
router.post("/request", authenticateUser, validateLeaveRequest, requestLeave);
router.get("/history", authenticateUser, validatePagination, getLeaveHistory);
router.post("/cancel/:requestId", authenticateUser, cancelLeaveRequest);

// Admin routes
router.get(
  "/admin/all",
  authenticateAdmin,
  validatePagination,
  getAllLeaveBalances
);
router.put("/admin/:userId/reset", authenticateAdmin, resetLeaveBalance);
router.patch("/admin/:userId/adjust", authenticateAdmin, adjustLeaveBalance);
router.get("/statistics", authenticateAdmin, getLeaveStatistics);

module.exports = router;
