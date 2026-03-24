import { RedisClient } from "../config/db.config";
import User from "../model/user.model";
import { createError } from "../utils/error.util";

export const signUpService = async (
  name: string,
  email: string,
  password: string,
  passwordConfirm: string,
) => {
  try {
    const usersKeyPrefix = `users:all:`;
    const user = await User.create({
      name,
      email,
      password,
      passwordConfirm,
      role: "user",
    });
    if (!user) {
      throw createError("Error while creating user", 400);
    }
    const usersCacheKeys = await RedisClient.keys(`${usersKeyPrefix}*`);
    if (usersCacheKeys.length > 0) {
      await RedisClient.del(...usersCacheKeys);
    }
    return user;
  } catch (error) {
    throw error;
  }
};

export const loginService = async (
  email: string,
  candidatePassword: string,
  refreshToken: string,
  refreshTokenExpires: Date
) => {
  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(candidatePassword))) {
      throw createError("email or password is incorrect", 400);
    }

    // Update refresh-token metadata only after credentials are verified.
    user.refreshToken = refreshToken;
    user.refreshTokenExpires = refreshTokenExpires;
    await user.save({ validateBeforeSave: false });

    return user;
  } catch (error) {
    throw error;
  }
};

export const logoutService = async (userId: string) => {
  try {
    const user = await User.findByIdAndUpdate(userId, {
      refreshToken: null,
      refreshTokenExpires: null,
    });

    if (!user) {
      throw createError("The user with this token does not exist", 404);
    }

    return user;
  } catch (error) {
    throw error;
  }
};
