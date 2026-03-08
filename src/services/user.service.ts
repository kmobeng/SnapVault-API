import mongoose from "mongoose";
import { RedisClient } from "../config/db.config";
import User from "../model/user.model";
import { createError } from "../utils/error.util";
import APIFeatures from "../utils/APIFeatures.util";

export const getAllUsersService = async (queryString: any) => {
  const usersKey = `users:all`;
  try {
    const cachedUsers = await RedisClient.get(usersKey);
    if (cachedUsers) {
      return JSON.parse(cachedUsers);
    }
    const features = new APIFeatures(User.find(), queryString);
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
  const userKey = `user:${userId}`;
  const usersKey = `users:all`;
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

    RedisClient.del(userKey);
    RedisClient.del(usersKey);
    return user;
  } catch (error) {
    throw error;
  }
};

export const deleteUserService = async (userId: string) => {
  const userKey = `user:${userId}`;
  const usersKey = `users:all`;
  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      throw createError("No user found", 404);
    }

    RedisClient.del(userKey);
    RedisClient.del(usersKey);
    return user;
  } catch (error) {
    throw error;
  }
};

export const changePasswordService = async (user:any,id:string,currentPassword:string, newPassword:string, newPasswordConfirm:string)=>{
  try {
    
    await user.comparePassword(currentPassword);
    const updatedUser = await User.findByIdAndUpdate(id,{password:newPassword,passwordConfirm:newPasswordConfirm}, {new: true, runValidators: true});
    return updatedUser;
  } catch (error) {
    throw error
  }
}