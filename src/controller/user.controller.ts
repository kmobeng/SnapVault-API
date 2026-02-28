import { NextFunction, Request, Response } from "express";
import {
  deleteUserService,
  getAllUsersService,
  getSingleUserService,
  updateMeService,
} from "../services/user.service";
import { createError } from "../utils/error.util";
import { AuthRequest } from "./auth.controller";

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const users = await getAllUsersService(req.query);
    res
      .status(200)
      .json({ status: "success", result: users.length, data: users });
  } catch (error) {}
};

export const getSingleUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw createError("No user Id provided", 400);
    }
    const user = await getSingleUserService(userId.toString());
    res.status(200).json({ status: "success", data: user });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  req.params.userId = req.user._id.toString();
  next();
};

export const updateMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { name, username } = req.body;
    const user = await updateMeService(req.user._id.toString(), name, username);
    res.status(200).json({ status: "success", data: user });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw createError("No user ID provided", 400);
    }
    const user = await deleteUserService(userId.toString());
    res.status(200).json({ status: "success" });
  } catch (error) {
    next(error);
  }
};
