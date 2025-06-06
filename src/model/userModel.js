const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      minlength: [3, "Name must be at least 3 characters long"],
      maxlength: [50, "Name must be at most 50 characters long"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please fill a valid email address",
      ],
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    phoneNumber: {
      type: [String],
      required: [true, "Phone number is required"],
      validate: {
        validator: function (phoneArray) {
          return phoneArray && phoneArray.length > 0;
        },
        message: "At least one phone number is required",
      },
      trim: true,
    },
    education: {
      type: String,
      required: [true, "Education is required"],
      trim: true,
    },
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },
    supervisor: {
      type: String,
      enum: ["Ko Kaung San Phoe", "Ko Kyaw Swa Win", "Dimple", "Budiman"],
      required: [true, "Supervisor is required"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    leave: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Leave",
    },
    refreshTokens: [
      {
        token: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
          expires: 604800,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

userSchema.post("save", async function (doc, next) {
  try {
    if (this.isNew && !this.leave) {
      const Leave = require("./leaveModel");

      const leave = new Leave({
        userId: doc._id,
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

      await mongoose
        .model("User")
        .updateOne({ _id: doc._id }, { leave: savedLeave._id });

      console.log(`Leave record created for user ${doc._id}`);
    }
    next();
  } catch (error) {
    console.error("Error creating leave record:", error);
    next(error);
  }
});

userSchema.virtual("leaveDetails", {
  ref: "Leave",
  localField: "_id",
  foreignField: "userId",
  justOne: true,
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error("Password comparison failed");
  }
};

userSchema.methods.addRefreshToken = function (token) {
  this.refreshTokens.push({ token });
  return this.save();
};

userSchema.methods.removeRefreshToken = function (token) {
  this.refreshTokens = this.refreshTokens.filter((rt) => rt.token !== token);
  return this.save();
};

userSchema.methods.removeAllRefreshTokens = function () {
  this.refreshTokens = [];
  return this.save();
};

userSchema.methods.hasRefreshToken = function (token) {
  return this.refreshTokens.some((rt) => rt.token === token);
};

const User = mongoose.model("User", userSchema);
module.exports = User;
