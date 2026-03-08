import { RedisClient } from "../config/db.config";
import User from "../model/user.model";
import { createError } from "../utils/error.util";

export const signUpService = async (
  name: string,
  email: string,

  password: string,
  passwordConfirm: string,
  role: string,
) => {
  try {
    const usersKey = `users:all`;
    const user = await User.create({
      name,
      email,
      password,
      passwordConfirm,
      role,
    });
    if (!user) {
      throw createError("Error while creating user", 400);
    }
    RedisClient.del(usersKey);
    return user;
  } catch (error) {
    throw error;
  }
};

export const loginService = async (
  email: string,
  candidatePassword: string,
) => {
  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePassword(candidatePassword))) {
      throw createError("email or password is incorrect", 400);
    }
    return user;
  } catch (error) {
    throw error;
  }
};
