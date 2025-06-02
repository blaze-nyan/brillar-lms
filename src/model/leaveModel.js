const mongoose = require("mongoose");

const leaveSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      unique: true,
      required: [true, "User ID is required"],
    },
    annualLeave: {
      type: Number,
      default: 10,
      min: [0, "Annual leave cannot be negative"],
      max: [10, "Annual leave cannot exceed 10 days"],
    },
    sickLeave: {
      type: Number,
      default: 14,
      min: [0, "Sick leave cannot be negative"],
      max: [14, "Sick leave cannot exceed 14 days"],
    },
    casualLeave: {
      type: Number,
      default: 5,
      min: [0, "Casual leave cannot be negative"],
      max: [5, "Casual leave cannot exceed 5 days"],
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

leaveSchema.pre("save", function (next) {
  if (this.startDate && this.endDate) {
    if (this.endDate <= this.startDate) {
      next(new Error("End date must be after start date"));
      return;
    }
  }
  next();
});

const Leave = mongoose.model("Leave", leaveSchema);
module.exports = Leave;
