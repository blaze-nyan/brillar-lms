const connect = require("./src/config/db");
const express = require("express");
const pino = require("pino-http");
const app = express();
const port = 8080;

app.use(pino());
app.use(express.json());
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
