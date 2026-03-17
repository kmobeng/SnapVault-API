import { NextFunction, Request, Response } from "express";
import {
  changePasswordService,
  deleteUserService,
  getAllUsersService,
  getSingleUserService,
  updateMeService,
} from "../services/user.service";
import { createError } from "../utils/error.util";

export const getAllUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const users = await getAllUsersService(req.query);
    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      result: users.length,
      data: users,
    });
  } catch (error) {}
};

export const getSingleUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      throw createError("No user Id provided", 400);
    }
    const user = await getSingleUserService(userId.toString());
    res
      .status(200)
      .json({
        status: "success",
        accessToken: res.locals.token,
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
    const { name } = req.body;
    const user = await updateMeService(req.currentUser._id.toString(), name);
    res
      .status(200)
      .json({
        status: "success",
        accessToken: res.locals.token,
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
    res
      .status(200)
      .json({
        status: "success",
        accessToken: res.locals.token,
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
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;

    if (req.currentUser.needToChangePassword == false && !currentPassword) {
      throw createError(
        "Please provide current password,new password and confirm password to continue",
        400,
      );
    }

    if (!newPassword || !newPasswordConfirm) {
      throw createError(
        "Please provide new password and confirm password to continue",
        400,
      );
    }

    const result = await changePasswordService(
      req.currentUser._id.toString(),
      newPassword,
      newPasswordConfirm,
      currentPassword,
    );

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};
