import { NextFunction, Request, Response } from "express";
import {
  changePasswordService,
  deleteUserService,
  getAllUsersService,
  getSingleUserService,
  updateMeService,
} from "../services/user.service";
import { createError } from "../utils/error.util";
import {
  changePasswordSchema,
  updateMeSchema,
} from "../validators/user.validator";

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const users = await getAllUsersService(req.query);
    res.status(200).json({
      status: "success",

      result: users.length,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};

export const getSingleUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw createError("No user ID provided", 400);
    }
    const user = await getSingleUserService(userId);
    res.status(200).json({
      status: "success",

      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.params.userId = req.currentUser._id.toString();
  next();
};

export const updateMe = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }

    const { name } = parsed.data;
    const user = await updateMeService(req.currentUser._id.toString(), name);
    res.status(200).json({
      status: "success",

      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw createError("No user ID provided", 400);
    }
    const user = await deleteUserService(userId.toString());
    res.status(200).json({
      status: "success",
    });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      const errorMessages = parsed.error.issues
        .map((err: any) => err.message)
        .join(", ");
      throw createError(errorMessages, 400);
    }

    const { currentPassword, newPassword, newPasswordConfirm } = parsed.data;

    if (!req.currentUser.needToChangePassword && !currentPassword) {
      throw createError("Please provide current password to continue", 400);
    }

    const result = await changePasswordService(
      req.currentUser._id.toString(),
      newPassword,
      newPasswordConfirm,
      currentPassword,
    );

    res.status(200).json({
      status: "success",

      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};
