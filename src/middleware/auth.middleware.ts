import JWT from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.util";
import User, { IUser } from "../model/user.model";

declare global {
  namespace Express {
    interface Request {
      currentUser: IUser;
    }
  }
}

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
  try {
    let token: any;
    if (req.user) {
      return next();
    }

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw createError("You are not logged in. Please login to continue", 401);
    }

    const decoded = JWT.verify(token, process.env.JWT_SECRET!) as JWTPayload;
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
