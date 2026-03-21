import JWT from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.util";
import User, { IUser } from "../model/user.model";
import crypto from "crypto";
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
    let accessToken: any;

    if (req.cookies.accessToken) {
      accessToken = req.cookies.accessToken;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      accessToken = req.headers.authorization.split(" ")[1];
    }

    if (!accessToken) {
      throw createError("You are not logged in. Please login to continue", 401);
    }

    decoded = JWT.verify(accessToken, process.env.JWT_SECRET!) as JWTPayload;
    const currentUser = await User.findById(decoded.id).select("+password");

    if (!currentUser) {
      throw createError("The user with this token does not exist", 404);
    }

    if(!currentUser.refreshToken && !currentUser.refreshTokenExpires) {
      throw createError("Session expired. Please login again", 401);
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      throw createError("Password changed. Please login again", 400);
    }

    req.currentUser = currentUser;

    next();
  } catch (error: any) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return next(
          createError("You are not logged in please login to continue", 401),
        );
      }

      const hashedToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      const user = await User.findOne({
        refreshToken: hashedToken,
        refreshTokenExpires: { $gt: Date.now() },
      });

      if (!user) {
        return next(createError("Session Expired. Please login again", 401));
      }
      const accessToken = await Token(res, user);

      res.locals.token = accessToken;

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
