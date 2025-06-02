const connect = require("./src/config/db");
const express = require("express");

const cookieParser = require("cookie-parser");
const logger = require("./src/utils/logger");
const app = express();
const port = 8080;
const adminRoutes = require("./src/routes/admin");
const userRoutes = require("./src/routes/user");
const leaveRoutes = require("./src/routes/leave");
app.use(logger.expressMiddleware());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api/auth/admin", adminRoutes);
app.use("/api/auth/user", userRoutes);
app.use("/api/auth/leave", leaveRoutes);

connect()
  .then(() => console.log("Database connected successfully"))
  .catch((err) => console.error("Database connection failed:", err));

app.get("/", (req, res) => {
  req.log.info("Hello World route accessed");
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log("server is running on port:" + port);
});
