import request from "supertest";
import User, { IUser } from "../../model/user.model";
import app from "../../app";

interface UserOverrides {
  name?: string;
  email?: string;
  password?: string;
  passwordConfirm?: string;
  isEmailVerified?: boolean;
  needToChangePassword?: boolean;
  role?: "user" | "admin";
}

export const createVerifiedUser = async (overrides: UserOverrides = {}) => {
  const timestamp = Date.now();
  const password = overrides.password ?? "Password123!";

  const user = await User.create({
    name: overrides.name ?? `Test User ${timestamp}`,
    email: overrides.email ?? `user${timestamp}@example.com`,
    password,
    passwordConfirm: overrides.passwordConfirm ?? password,
    role: overrides.role ?? "user",
  });

  user.isEmailVerified = overrides.isEmailVerified ?? true;
  user.needToChangePassword = overrides.needToChangePassword ?? false;
  user.refreshToken = "test-refresh-token";
  user.refreshTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await user.save({ validateBeforeSave: false });
  return user;
};

export const loginAndGetCookies = async (user: IUser, password: string) => {
  const response = await request(app).post("/api/auth/login").send({
    email: user.email,
    password,
  });

  if (response.status !== 200) {
    throw new Error(`Login failed with status ${response.status}`);
  }

  const cookies = response.headers["set-cookie"];
  if (!cookies) {
    throw new Error("Login did not return cookies");
  }

  return Array.isArray(cookies) ? cookies : [cookies];
};

export const buildAccessCookie = (user: IUser) => {
  const accessToken = user.signAccessToken();
  return [`accessToken=${accessToken}`];
};
