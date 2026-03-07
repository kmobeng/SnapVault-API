import express, { NextFunction, Request, Response } from "express";
import morgan from "morgan";
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

const app = express();

app.use(morgan("dev"));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use(
  cookieSession({
    maxAge: 24 * 60 * 60 * 1000,
    keys: [process.env.COOKIE_KEY!],
  }),
);

app.use((req:Request, res:Response, next:NextFunction) => {
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

// features to add when i am done with oauth
// handle logout for both jwt and oauth users
// fix cors. origin and credentials
// implement cookies
// res.cookie('refreshToken', token, {
//   httpOnly: true,    // you set this
//   secure: true,      // you set this
//   sameSite: 'strict' // you set this
// });
// change how username are assigned
// logout fuctionality.. access token and refresh  token
// password change for oauth and local user
// implement linking to google so that he can login with both local and google
// winston logging
// sending real emails with sendgrid
// add env.example to github
