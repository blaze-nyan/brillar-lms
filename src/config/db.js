require("dotenv").config();
const mongoose = require("mongoose");
const url = process.env.MONGODB_URI || "mongodb://localhost:27017";
if (!url) {
  throw new Error("Define the mongodb url in .env");
}
async function connect() {
  try {
    await mongoose.connect(url);
    const connection = mongoose.connection;
    connection.on("connected", () => {
      console.log("Mongodb is successfully connected");
    });
    connection.on("error", (err) => {
      console.log("There is an error on connecting database" + err);
      process.exit(1);
    });
  } catch (error) {
    console.log(error);
  }
}
module.exports = connect;
