import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler } from "./middleware/errorHandler.middleware";
import userRoute from "./router/user.route";
import photoRoute from "./router/photo.route";
import albumRoute from "./router/album.route";
import authRoute from "./router/auth.route";
import "./config/passport.config";
import cookieSession from "cookie-session";
import passport from "passport";
import httpLogger from "./config/httpLogger.config";
import cookieParser from "cookie-parser";

const app = express();

const allowedOrigin = process.env.CLIENT_URL;

app.use(httpLogger);
app.use(helmet());
app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

app.use(
  cookieSession({
    maxAge: 60 * 60 * 1000,
    keys: [process.env.COOKIE_KEY!],
  }),
);

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.session && !req.session.regenerate) {
    req.session.regenerate = (cb: any) => cb();
  }
  if (req.session && !req.session.save) {
    req.session.save = (cb: any) => cb();
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use("/api/auth", authRoute);

app.use("/api/user", userRoute);
app.use("/api/", albumRoute, photoRoute);

app.use(errorHandler);

export default app;
