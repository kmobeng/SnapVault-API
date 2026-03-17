import JWT from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.util";
import User, { IUser } from "../model/user.model";
import logger from "../config/wiston.config";
import { Token } from "../controller/auth.controller";

interface JWTPayload {
  id: string;
  iat: number;
  exp: number;
}

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let decoded: JWTPayload | undefined;
  try {
    let token: any;
    if (req.user) {
      req.currentUser = req.user as IUser;
      return next();
    }

    token = req.cookies.token || req.headers.authorization?.split(" ")[1];

    if (!token) {
      throw createError("You are not logged in. Please login to continue", 401);
    }

    decoded = JWT.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const currentUser = await User.findById(decoded.id).select("+password");

    if (!currentUser) {
      throw createError("The user with this token does not exist", 404);
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      throw createError("Password changed. Please login again", 400);
    }

    req.currentUser = currentUser;

    next();
  } catch (error) {
    console.log("this is the decoded jwt: ",decoded)
    if (error instanceof JWT.JsonWebTokenError && decoded) {
      const user = await User.findById(decoded.id);
      if(!user){
        return next(createError("The user with this token does not exist", 404));
      }
      if (user.refreshTokenExpires && user.refreshTokenExpires < new Date()) {
        return next(createError("Your session has expired. Please login again", 401));
      }

      res.locals.accessToken = Token(res, user);
      req.currentUser = user;
      return next();
    }
    next(error);
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.currentUser.role)) {
      return next(
        createError("You do not have permission to accesss this action", 403),
      );
    }
    next();
  };
};

export const needToChangePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.currentUser.needToChangePassword) {
    throw createError("You need to change your password to continue", 403);
  }
  next();
};

export const isEmailVerified = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.currentUser.isEmailVerified === false) {
    throw createError(
      "Your email is not verified. Please verify your email to continue",
      403,
    );
  }
  next();
};
