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
      total: { type: Number, default: 10 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 10 },
    },
    sickLeave: {
      total: { type: Number, default: 14 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 14 },
    },
    casualLeave: {
      total: { type: Number, default: 5 },
      used: { type: Number, default: 0 },
      remaining: { type: Number, default: 5 },
    },
    currentLeave: {
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      type: { type: String, default: null },
      days: { type: Number, default: 0 },
    },
    history: [
      {
        leaveType: String,
        startDate: Date,
        endDate: Date,
        days: Number,
        reason: String,
        status: {
          type: String,
          enum: ["pending", "approved", "rejected", "cancelled"],
          default: "approved",
        },
        appliedDate: { type: Date, default: Date.now },
        approvedDate: Date,
        approvedBy: String,
        rejectionReason: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Update remaining when used changes
leaveSchema.pre("save", function (next) {
  if (this.isModified("annualLeave.used")) {
    this.annualLeave.remaining = this.annualLeave.total - this.annualLeave.used;
  }
  if (this.isModified("sickLeave.used")) {
    this.sickLeave.remaining = this.sickLeave.total - this.sickLeave.used;
  }
  if (this.isModified("casualLeave.used")) {
    this.casualLeave.remaining = this.casualLeave.total - this.casualLeave.used;
  }
  next();
});

const Leave = mongoose.model("Leave", leaveSchema);
module.exports = Leave;
