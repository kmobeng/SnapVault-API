import request from "supertest";
import app from "../app";
import User from "../model/user.model";
import {
  buildAccessCookie,
  createVerifiedUser,
  loginAndGetCookies,
} from "./helpers/auth";

const getCookieHeader = (cookies: string | string[] | undefined) => {
  if (!cookies) {
    throw new Error("Login did not return cookies");
  }
  return Array.isArray(cookies) ? cookies : [cookies];
};

describe("Auth and user flows", () => {
  it("signs up, logs in, and reads the profile", async () => {
    const email = `signup${Date.now()}@example.com`;
    const password = "Password123!";

    const signupResponse = await request(app).post("/api/auth/signup").send({
      name: "Signup User",
      email,
      password,
      passwordConfirm: password,
    });

    expect(signupResponse.status).toBe(201);

    const createdUser = await User.findOne({ email });
    expect(createdUser).toBeTruthy();

    createdUser!.isEmailVerified = true;
    await createdUser!.save({ validateBeforeSave: false });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(loginResponse.status).toBe(200);
    const cookies = getCookieHeader(loginResponse.headers["set-cookie"]);

    const meResponse = await request(app)
      .get("/api/user/me")
      .set("Cookie", cookies);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body).toHaveProperty("data");
  });

  it("updates profile name", async () => {
    const user = await createVerifiedUser();

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "Password123!",
    });

    const cookies = getCookieHeader(loginResponse.headers["set-cookie"]);

    const updateResponse = await request(app)
      .patch("/api/user/update-me")
      .set("Cookie", cookies)
      .send({ name: "Updated Name" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toHaveProperty("data");
  });

  it("changes password and allows re-login", async () => {
    const user = await createVerifiedUser({
      email: `changepw${Date.now()}@example.com`,
    });

    const loginResponse = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "Password123!",
    });

    const cookies = getCookieHeader(loginResponse.headers["set-cookie"]);

    const changeResponse = await request(app)
      .patch("/api/user/change-password")
      .set("Cookie", cookies)
      .send({
        currentPassword: "Password123!",
        newPassword: "NewPassword123!",
        newPasswordConfirm: "NewPassword123!",
      });

    expect(changeResponse.status).toBe(200);
    expect(changeResponse.body).toHaveProperty(
      "message",
      "Password changed successfully",
    );

    const reLoginResponse = await request(app).post("/api/auth/login").send({
      email: user.email,
      password: "NewPassword123!",
    });

    expect(reLoginResponse.status).toBe(200);
  });

  it("restricts admin-only routes", async () => {
    const regularUser = await createVerifiedUser({
      email: `regular${Date.now()}@example.com`,
    });

    const regularCookies = buildAccessCookie(regularUser);

    const forbiddenResponse = await request(app)
      .get("/api/user")
      .set("Cookie", regularCookies);

    expect(forbiddenResponse.status).toBe(403);

    const adminUser = await createVerifiedUser({
      email: `admin${Date.now()}@example.com`,
      role: "admin",
    });

    const adminCookies = buildAccessCookie(adminUser);

    const adminResponse = await request(app)
      .get("/api/user")
      .set("Cookie", adminCookies);

    expect(adminResponse.status).toBe(200);
    expect(adminResponse.body).toHaveProperty("data");
  });
});
