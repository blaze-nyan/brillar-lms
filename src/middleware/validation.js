const validateUserRegistration = (req, res, next) => {
  const { name, email, password, phoneNumber, education, address, supervisor } =
    req.body;
  const errors = [];

  if (!name || typeof name !== "string") {
    errors.push("Name is required and must be a string");
  } else if (name.trim().length < 3 || name.trim().length > 50) {
    errors.push("Name must be between 3 and 50 characters");
  }

  if (!email || typeof email !== "string") {
    errors.push("Email is required and must be a string");
  } else {
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      errors.push("Please provide a valid email address");
    }
  }

  if (!password || typeof password !== "string") {
    errors.push("Password is required and must be a string");
  } else if (password.length < 6) {
    errors.push("Password must be at least 6 characters long");
  }

  if (!phoneNumber) {
    errors.push("Phone number is required");
  }

  if (!education || typeof education !== "string") {
    errors.push("Education is required and must be a string");
  }

  if (!address || typeof address !== "string") {
    errors.push("Address is required and must be a string");
  }

  const validSupervisors = [
    "Ko Kaung San Phoe",
    "Ko Kyaw Swa Win",
    "Dimple",
    "Budiman",
  ];
  if (!supervisor || !validSupervisors.includes(supervisor)) {
    errors.push("Supervisor must be one of: " + validSupervisors.join(", "));
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

const validateAdminLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== "string") {
    errors.push("Email is required");
  }

  if (!password || typeof password !== "string") {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email || typeof email !== "string") {
    errors.push("Email is required");
  }

  if (!password || typeof password !== "string") {
    errors.push("Password is required");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

const validateLeaveRequest = (req, res, next) => {
  const { leaveType, startDate, endDate, days } = req.body;
  const errors = [];

  const validLeaveTypes = ["annualLeave", "sickLeave", "casualLeave"];
  if (!leaveType || !validLeaveTypes.includes(leaveType)) {
    errors.push("Leave type must be one of: " + validLeaveTypes.join(", "));
  }

  if (!startDate) {
    errors.push("Start date is required");
  } else if (new Date(startDate) < new Date().setHours(0, 0, 0, 0)) {
    errors.push("Start date cannot be in the past");
  }

  if (!endDate) {
    errors.push("End date is required");
  } else if (new Date(endDate) <= new Date(startDate)) {
    errors.push("End date must be after start date");
  }

  if (!days || typeof days !== "number" || days <= 0) {
    errors.push("Days must be a positive number");
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

module.exports = {
  validateUserRegistration,
  validateAdminLogin,
  validateLogin,
  validateLeaveRequest,
};
