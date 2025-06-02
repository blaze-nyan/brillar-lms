const User = require("../model/userModel");
const Leave = require("../model/leaveModel");
const { createChildLogger } = require("../utils/logger");

const logger = createChildLogger("LeaveManagement");

const getLeaveBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate("leave");
    if (!user || !user.leave) {
      return res.status(404).json({
        success: false,
        message: "Leave record not found",
      });
    }

    logger.info("Leave balance retrieved", { userId });

    res.status(200).json({
      success: true,
      data: {
        leaveBalance: {
          annualLeave: user.leave.annualLeave,
          sickLeave: user.leave.sickLeave,
          casualLeave: user.leave.casualLeave,
          lastUpdated: user.leave.updatedAt,
        },
      },
    });
  } catch (error) {
    logger.error("Get leave balance error", error, { userId: req.user?.id });
    req.log.error("Get leave balance failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const requestLeave = async (req, res) => {
  try {
    const userId = req.user.id;
    const { leaveType, days, startDate, endDate, reason } = req.body;

    const user = await User.findById(userId).populate("leave");
    if (!user || !user.leave) {
      return res.status(404).json({
        success: false,
        message: "Leave record not found",
      });
    }

    const leave = user.leave;

    if (leave[leaveType] < days) {
      logger.warn("Insufficient leave balance", {
        userId,
        leaveType,
        requested: days,
        available: leave[leaveType],
      });
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} balance. Available: ${leave[leaveType]} days, Requested: ${days} days`,
      });
    }

    if (leave.startDate && leave.endDate) {
      const existingStart = new Date(leave.startDate);
      const existingEnd = new Date(leave.endDate);
      const newStart = new Date(startDate);
      const newEnd = new Date(endDate);

      if (newStart <= existingEnd && newEnd >= existingStart) {
        return res.status(400).json({
          success: false,
          message: "Leave dates overlap with existing leave period",
        });
      }
    }

    leave[leaveType] -= days;
    leave.startDate = startDate;
    leave.endDate = endDate;

    await leave.save();

    logger.info("Leave requested successfully", {
      userId,
      leaveType,
      days,
      remainingBalance: leave[leaveType],
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      message: "Leave requested successfully",
      data: {
        leaveRequest: {
          leaveType,
          days,
          startDate,
          endDate,
          reason,
          remainingBalance: leave[leaveType],
        },
        currentBalance: {
          annualLeave: leave.annualLeave,
          sickLeave: leave.sickLeave,
          casualLeave: leave.casualLeave,
        },
      },
    });
  } catch (error) {
    logger.error("Request leave error", error, { userId: req.user?.id });
    req.log.error("Request leave failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getAllLeaveBalances = async (req, res) => {
  try {
    const { page = 1, limit = 10, supervisor } = req.query;
    const skip = (page - 1) * limit;

    let userQuery = {};
    if (supervisor) {
      userQuery.supervisor = supervisor;
    }

    const users = await User.find(userQuery)
      .populate("leave")
      .select("name email supervisor leave createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(userQuery);

    const leaveData = users.map((user) => ({
      userId: user._id,
      name: user.name,
      email: user.email,
      supervisor: user.supervisor,
      leaveBalance: user.leave
        ? {
            annualLeave: user.leave.annualLeave,
            sickLeave: user.leave.sickLeave,
            casualLeave: user.leave.casualLeave,
            startDate: user.leave.startDate,
            endDate: user.leave.endDate,
            lastUpdated: user.leave.updatedAt,
          }
        : null,
    }));

    logger.info("All leave balances retrieved by admin", {
      adminId: req.currentAdmin._id,
      count: users.length,
      total,
      supervisor,
    });

    res.status(200).json({
      success: true,
      data: {
        leaves: leaveData,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error("Get all leave balances error", error, {
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Get all leave balances failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const resetLeaveBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { annualLeave = 10, sickLeave = 14, casualLeave = 5 } = req.body;

    const user = await User.findById(userId).populate("leave");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.leave) {
      return res.status(404).json({
        success: false,
        message: "Leave record not found",
      });
    }

    const leave = user.leave;
    leave.annualLeave = annualLeave;
    leave.sickLeave = sickLeave;
    leave.casualLeave = casualLeave;
    leave.startDate = null;
    leave.endDate = null;

    await leave.save();

    logger.info("Leave balance reset by admin", {
      userId,
      adminId: req.currentAdmin._id,
      newBalance: { annualLeave, sickLeave, casualLeave },
    });

    res.status(200).json({
      success: true,
      message: "Leave balance reset successfully",
      data: {
        userId,
        leaveBalance: {
          annualLeave: leave.annualLeave,
          sickLeave: leave.sickLeave,
          casualLeave: leave.casualLeave,
        },
      },
    });
  } catch (error) {
    logger.error("Reset leave balance error", error, {
      userId: req.params.userId,
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Reset leave balance failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const adjustLeaveBalance = async (req, res) => {
  try {
    const { userId } = req.params;
    const { leaveType, adjustment, reason } = req.body;

    if (!["annualLeave", "sickLeave", "casualLeave"].includes(leaveType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid leave type",
      });
    }

    const user = await User.findById(userId).populate("leave");
    if (!user || !user.leave) {
      return res.status(404).json({
        success: false,
        message: "User or leave record not found",
      });
    }

    const leave = user.leave;
    const oldBalance = leave[leaveType];
    const newBalance = Math.max(0, oldBalance + adjustment);

    leave[leaveType] = newBalance;
    await leave.save();

    logger.info("Leave balance adjusted by admin", {
      userId,
      adminId: req.currentAdmin._id,
      leaveType,
      oldBalance,
      adjustment,
      newBalance,
      reason,
    });

    res.status(200).json({
      success: true,
      message: "Leave balance adjusted successfully",
      data: {
        userId,
        leaveType,
        oldBalance,
        adjustment,
        newBalance,
        reason,
      },
    });
  } catch (error) {
    logger.error("Adjust leave balance error", error, {
      userId: req.params.userId,
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Adjust leave balance failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getLeaveStatistics = async (req, res) => {
  try {
    const stats = await Leave.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          avgAnnualLeave: { $avg: "$annualLeave" },
          avgSickLeave: { $avg: "$sickLeave" },
          avgCasualLeave: { $avg: "$casualLeave" },
          totalAnnualLeave: { $sum: "$annualLeave" },
          totalSickLeave: { $sum: "$sickLeave" },
          totalCasualLeave: { $sum: "$casualLeave" },
        },
      },
    ]);

    const usersOnLeave = await Leave.countDocuments({
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    const statistics = stats[0] || {
      totalUsers: 0,
      avgAnnualLeave: 0,
      avgSickLeave: 0,
      avgCasualLeave: 0,
      totalAnnualLeave: 0,
      totalSickLeave: 0,
      totalCasualLeave: 0,
    };

    res.status(200).json({
      success: true,
      data: {
        statistics: {
          ...statistics,
          usersCurrentlyOnLeave: usersOnLeave,
        },
      },
    });
  } catch (error) {
    logger.error("Get leave statistics error", error);
    req.log.error("Get leave statistics failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getLeaveBalance,
  requestLeave,
  getAllLeaveBalances,
  resetLeaveBalance,
  adjustLeaveBalance,
  getLeaveStatistics,
};
