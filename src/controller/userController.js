const User = require("../model/userModel");
const Leave = require("../model/leaveModel");
const { createChildLogger } = require("../utils/logger");

const logger = createChildLogger("UserManagement");

const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, supervisor, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};

    if (supervisor) {
      query.supervisor = supervisor;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users = await User.find(query)
      .populate("leave")
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    logger.info("Users retrieved by admin", {
      adminId: req.currentAdmin._id,
      count: users.length,
      total,
      page,
      supervisor,
      search,
    });

    res.status(200).json({
      success: true,
      data: {
        users,
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
    logger.error("Get all users error", error, {
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Get all users failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId)
      .populate("leave")
      .select("-password");

    if (!user) {
      logger.warn("User not found", {
        userId,
        adminId: req.currentAdmin._id,
      });
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    logger.info("User retrieved by admin", {
      userId: user._id,
      adminId: req.currentAdmin._id,
    });

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    logger.error("Get user by ID error", error, {
      userId: req.params.userId,
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Get user by ID failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, email, phoneNumber, education, address, supervisor } =
      req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: userId },
      });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "Email already exists",
        });
      }
      user.email = email.toLowerCase().trim();
    }

    if (
      phoneNumber &&
      JSON.stringify(phoneNumber) !== JSON.stringify(user.phoneNumber)
    ) {
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

    if (name) user.name = name.trim();
    if (education) user.education = education.trim();
    if (address) user.address = address.trim();
    if (supervisor) user.supervisor = supervisor;

    await user.save();

    logger.info("User updated by admin", {
      userId: user._id,
      adminId: req.currentAdmin._id,
      updatedFields: Object.keys(req.body),
    });

    res.status(200).json({
      success: true,
      message: "User updated successfully",
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
    logger.error("Update user error", error, {
      userId: req.params.userId,
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Update user failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.leave) {
      await Leave.findByIdAndDelete(user.leave);
    }

    await User.findByIdAndDelete(userId);

    logger.info("User deleted by admin", {
      userId,
      adminId: req.currentAdmin._id,
      userEmail: user.email,
    });

    res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    logger.error("Delete user error", error, {
      userId: req.params.userId,
      adminId: req.currentAdmin?._id,
    });
    req.log.error("Delete user failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const getSupervisors = async (req, res) => {
  try {
    const supervisors = [
      "Ko Kaung San Phoe",
      "Ko Kyaw Swa Win",
      "Dimple",
      "Budiman",
    ];

    const supervisorStats = await Promise.all(
      supervisors.map(async (supervisor) => {
        const count = await User.countDocuments({ supervisor });
        return { name: supervisor, userCount: count };
      })
    );

    res.status(200).json({
      success: true,
      data: { supervisors: supervisorStats },
    });
  } catch (error) {
    logger.error("Get supervisors error", error);
    req.log.error("Get supervisors failed", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getSupervisors,
};
