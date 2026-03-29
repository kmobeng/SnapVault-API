import mongoose from "mongoose";
import { RedisClient } from "../config/db.config";
import User, { IUser } from "../model/user.model";
import { createError } from "../utils/error.util";
import APIFeatures from "../utils/APIFeatures.util";
import { invalidateUserCache, invalidateUsersCache } from "../utils/redis.util";

export const getAllUsersService = async (queryString: any) => {
  const normalizedQuery = Object.keys(queryString)
    .sort()
    .reduce((acc: any, key) => {
      acc[key] = queryString[key];
      return acc;
    }, {});

  const usersKey = `users:all:${JSON.stringify(normalizedQuery)}`;
  try {
    const cachedUsers = await RedisClient.get(usersKey);
    if (cachedUsers) {
      return JSON.parse(cachedUsers);
    }
    const features = new APIFeatures(User.find(), queryString)
      .filter()
      .sort()
      .limitFields()
      .paginate();
    const users = await features.query.lean();
    if (users.length > 0) {
      await RedisClient.setex(usersKey, 3600, JSON.stringify(users));
    }
    return users;
  } catch (error) {
    throw error;
  }
};

export const getSingleUserService = async (userId: string) => {
  const userKey = `user:${userId}`;
  try {
    const cachedUser = await RedisClient.get(userKey);
    if (cachedUser) {
      return JSON.parse(cachedUser);
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw createError("Invalid User Id", 400);
    }
    const user = await User.findById(userId);
    if (!user) {
      throw createError("No user found", 404);
    }
    await RedisClient.setex(userKey, 3600, JSON.stringify(user));
    return user;
  } catch (error) {
    throw error;
  }
};

export const updateMeService = async (userId: string, name: string) => {
  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { name } },
      {
        new: true,
        runValidators: true,
      },
    );
    if (!user) {
      throw createError("Unable to update user", 404);
    }

    await invalidateUserCache(userId);
    await invalidateUsersCache();
    return user;
  } catch (error) {
    throw error;
  }
};

export const deleteUserService = async (userId: string) => {
  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw createError("No user found", 404);
    }

    await invalidateUserCache(userId);
    await invalidateUsersCache();
    return user;
  } catch (error) {
    throw error;
  }
};

export const changePasswordService = async (
  id: string,
  newPassword: string,
  newPasswordConfirm: string,
  currentPassword?: string,
) => {
  try {
    const user = await User.findById(id).select("+password");

    if (!user) {
      throw createError("no user found", 400);
    }

    if (user.needToChangePassword) {
      user.password = newPassword;
      user.passwordConfirm = newPasswordConfirm;
      user.needToChangePassword = false;
      await user.save();

      return user;
    }

    if (currentPassword && !(await user.comparePassword(currentPassword))) {
      throw createError("Incorrect password", 400);
    }

    user.password = newPassword;
    user.passwordConfirm = newPasswordConfirm;
    user.refreshToken = null;
    user.refreshTokenExpires = null;
    await user.save();

    return user;
  } catch (error) {
    throw error;
  }
};
