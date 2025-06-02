const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Leave = require("./leaveModel");
const userSchema = new mongoose.Schema({
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
    unique: [true, "Email must be unique"],
    lowercase: true,
    match: [
      /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
      "Please fill a valid email address",
    ],
    validate: {
      validator: async function (email) {
        const existingUser = await this.constructor.findOne({ email });
        if (existingUser) {
          return false;
        }
        return true;
      },
      message: "Email already exists",
    },

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
    unique: [true, "Phone number must be unique"],
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
});
userSchema.post("save", async function (doc, next) {
  try {
    if (!this.leave) {
      const leave = new Leave({
        userId: doc._id,
      });
      await leave.save();
      this.leave = leave._id;
    }
    next();
  } catch (error) {
    next(error);
  }
});
userSchema.virtual("leaveDetails", {
  ref: "Leave",
  localField: "_id",
  foreignField: "userId",
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
