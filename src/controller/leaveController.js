const User = require("../model/userModel");
const Leave = require("../model/leaveModel");
const { createChildLogger } = require("../utils/logger");

const logger = createChildLogger("LeaveManagement");

// Helper function to create leave record if it doesn't exist
const ensureLeaveRecord = async (userId) => {
  try {
    let user = await User.findById(userId).populate("leave");

    if (!user) {
      throw new Error("User not found");
    }

    if (!user.leave) {
      console.log("Creating leave record for user:", userId);

      const leave = new Leave({
        userId: user._id,
        annualLeave: {
          total: 10,
          used: 0,
          remaining: 10,
        },
        sickLeave: {
          total: 14,
          used: 0,
          remaining: 14,
        },
        casualLeave: {
          total: 5,
          used: 0,
          remaining: 5,
        },
        history: [],
      });

      const savedLeave = await leave.save();
      user.leave = savedLeave._id;
      await user.save();

      // Re-populate the leave data
      user = await User.findById(userId).populate("leave");
      console.log("Leave record created successfully for user:", userId);
    }

    return user;
  } catch (error) {
    console.error("Error ensuring leave record:", error);
    throw error;
  }
};

const getLeaveBalance = async (req, res) => {
  try {
    const userId = req.user.id;

    // Ensure leave record exists
    const user = await ensureLeaveRecord(userId);

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

    // Ensure leave record exists
    const user = await ensureLeaveRecord(userId);
    const leave = user.leave;

    // Check balance
    if (leave[leaveType].remaining < days) {
      logger.warn("Insufficient leave balance", {
        userId,
        leaveType,
        requested: days,
        available: leave[leaveType].remaining,
      });
      return res.status(400).json({
        success: false,
        message: `Insufficient ${leaveType} balance. Available: ${leave[leaveType].remaining} days, Requested: ${days} days`,
      });
    }

    // Update leave balance
    leave[leaveType].used += days;
    leave[leaveType].remaining -= days;

    // Set current leave
    leave.currentLeave = {
      startDate,
      endDate,
      type: leaveType,
      days,
    };

    // Add to history
    const leaveRequest = {
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      status: "approved",
      appliedDate: new Date(),
      approvedDate: new Date(),
      approvedBy: "Auto-approved",
    };

    leave.history.push(leaveRequest);
    await leave.save();

    logger.info("Leave requested successfully", {
      userId,
      leaveType,
      days,
      remainingBalance: leave[leaveType].remaining,
      startDate,
      endDate,
    });

    res.status(200).json({
      success: true,
      message: "Leave requested successfully",
      data: {
        leaveRequest: {
          ...leaveRequest,
          id: leave.history[leave.history.length - 1]._id,
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
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getLeaveHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Ensure leave record exists
    const user = await ensureLeaveRecord(userId);

    const history = user.leave.history
      .sort((a, b) => b.appliedDate - a.appliedDate)
      .slice(skip, skip + parseInt(limit));

    const total = user.leave.history.length;

    res.status(200).json({
      success: true,
      data: {
        requests: history.map((item) => ({
          id: item._id,
          userId: user._id,
          userName: user.name,
          userEmail: user.email,
          supervisor: user.supervisor,
          ...item.toObject(),
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    logger.error("Get leave history error", error, { userId: req.user?.id });
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const cancelLeaveRequest = async (req, res) => {
  try {
    const userId = req.user.id;
    const { requestId } = req.params;

    // Ensure leave record exists
    const user = await ensureLeaveRecord(userId);

    const leaveRequest = user.leave.history.id(requestId);
    if (!leaveRequest) {
      return res.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    if (leaveRequest.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending requests can be cancelled",
      });
    }

    // Update status
    leaveRequest.status = "cancelled";

    // Refund the days if it was approved
    if (leaveRequest.status === "approved") {
      user.leave[leaveRequest.leaveType].used -= leaveRequest.days;
      user.leave[leaveRequest.leaveType].remaining += leaveRequest.days;
    }

    await user.leave.save();

    res.status(200).json({
      success: true,
      message: "Leave request cancelled successfully",
    });
  } catch (error) {
    logger.error("Cancel leave request error", error);
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

    // Ensure all users have leave records
    const leaveData = await Promise.all(
      users.map(async (user) => {
        if (!user.leave) {
          // Create leave record for users who don't have one
          try {
            await ensureLeaveRecord(user._id);
            // Re-fetch user with populated leave
            const updatedUser = await User.findById(user._id).populate("leave");
            user = updatedUser;
          } catch (error) {
            console.error(
              `Failed to create leave record for user ${user._id}:`,
              error
            );
          }
        }

        return {
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
        };
      })
    );

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

    // Ensure leave record exists
    const user = await ensureLeaveRecord(userId);
    const leave = user.leave;

    leave.annualLeave = {
      total: annualLeave,
      used: 0,
      remaining: annualLeave,
    };
    leave.sickLeave = {
      total: sickLeave,
      used: 0,
      remaining: sickLeave,
    };
    leave.casualLeave = {
      total: casualLeave,
      used: 0,
      remaining: casualLeave,
    };
    leave.currentLeave = {
      startDate: null,
      endDate: null,
      type: null,
      days: 0,
    };

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

    // Ensure leave record exists
    const user = await ensureLeaveRecord(userId);
    const leave = user.leave;

    const oldBalance = leave[leaveType].remaining;
    const newRemaining = Math.max(0, oldBalance + adjustment);

    // Update the remaining balance
    leave[leaveType].remaining = newRemaining;

    // If increasing, increase total too to maintain consistency
    if (adjustment > 0) {
      leave[leaveType].total += adjustment;
    }

    await leave.save();

    logger.info("Leave balance adjusted by admin", {
      userId,
      adminId: req.currentAdmin._id,
      leaveType,
      oldBalance,
      adjustment,
      newBalance: newRemaining,
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
        newBalance: newRemaining,
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
    // Get total users count
    const totalUsers = await User.countDocuments();

    // Get users currently on leave
    const currentDate = new Date();
    const usersOnLeave = await Leave.countDocuments({
      "currentLeave.startDate": { $lte: currentDate },
      "currentLeave.endDate": { $gte: currentDate },
    });

    // Calculate average leave usage
    const leaveStats = await Leave.aggregate([
      {
        $group: {
          _id: null,
          avgAnnualUsed: { $avg: "$annualLeave.used" },
          avgSickUsed: { $avg: "$sickLeave.used" },
          avgCasualUsed: { $avg: "$casualLeave.used" },
          totalAnnualUsed: { $sum: "$annualLeave.used" },
          totalSickUsed: { $sum: "$sickLeave.used" },
          totalCasualUsed: { $sum: "$casualLeave.used" },
        },
      },
    ]);

    const statistics = leaveStats[0] || {
      avgAnnualUsed: 0,
      avgSickUsed: 0,
      avgCasualUsed: 0,
      totalAnnualUsed: 0,
      totalSickUsed: 0,
      totalCasualUsed: 0,
    };

    // Get leave distribution by supervisor
    const supervisorStats = await User.aggregate([
      {
        $lookup: {
          from: "leaves",
          localField: "leave",
          foreignField: "_id",
          as: "leaveData",
        },
      },
      {
        $unwind: {
          path: "$leaveData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $group: {
          _id: "$supervisor",
          totalLeaveUsed: {
            $sum: {
              $add: [
                { $ifNull: ["$leaveData.annualLeave.used", 0] },
                { $ifNull: ["$leaveData.sickLeave.used", 0] },
                { $ifNull: ["$leaveData.casualLeave.used", 0] },
              ],
            },
          },
        },
      },
    ]);

    const leaveDistributionBySupervisor = {};
    supervisorStats.forEach((stat) => {
      if (stat._id) {
        leaveDistributionBySupervisor[stat._id] = stat.totalLeaveUsed;
      }
    });

    // Get monthly leave distribution (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyStats = await Leave.aggregate([
      {
        $unwind: {
          path: "$history",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $match: {
          "history.appliedDate": { $gte: sixMonthsAgo },
          "history.status": "approved",
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$history.appliedDate" },
            month: { $month: "$history.appliedDate" },
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 },
      },
    ]);

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyLeaveDistribution = monthlyStats.map((stat) => ({
      month: monthNames[stat._id.month - 1],
      count: stat.count,
    }));

    const response = {
      totalUsers,
      usersOnLeave,
      averageLeaveUsage: {
        annualLeave: parseFloat(statistics.avgAnnualUsed.toFixed(1)) || 0,
        sickLeave: parseFloat(statistics.avgSickUsed.toFixed(1)) || 0,
        casualLeave: parseFloat(statistics.avgCasualUsed.toFixed(1)) || 0,
      },
      leaveDistributionByType: {
        annualLeave: statistics.totalAnnualUsed || 0,
        sickLeave: statistics.totalSickUsed || 0,
        casualLeave: statistics.totalCasualUsed || 0,
      },
      leaveDistributionBySupervisor,
      monthlyLeaveDistribution,
    };

    logger.info("Leave statistics retrieved", {
      adminId: req.currentAdmin._id,
    });

    res.status(200).json({
      success: true,
      data: {
        statistics: response,
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

// Export new functions
module.exports = {
  getLeaveBalance,
  requestLeave,
  getAllLeaveBalances,
  resetLeaveBalance,
  adjustLeaveBalance,
  getLeaveStatistics,
  getLeaveHistory,
  cancelLeaveRequest,
};
