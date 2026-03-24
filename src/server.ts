import dotenv from "dotenv";
dotenv.config();
import app from "./app";
import { connectDB } from "./config/db.config";
import logger from "./config/wiston.config";

const startServer = async () => {
  try {
    await connectDB();
    app.listen(process.env.PORT, () => {
      logger.info(`Server is listening on port ${process.env.PORT}`);
    });
  } catch (error) {
    logger.error("Error starting server", error);
  }
};

startServer();
