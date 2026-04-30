import request from "supertest";
import app from "../app";
import { createVerifiedUser, loginAndGetCookies } from "./helpers/auth";

describe("Share link flows", () => {
  it("creates a share link and resolves it", async () => {
    const user = await createVerifiedUser();

    const cookieHeader = await loginAndGetCookies(user, "Password123!");

    const albumResponse = await request(app)
      .post("/api/album")
      .set("Cookie", cookieHeader)
      .send({ name: `Shared Album ${Date.now()}`, visibility: "public" });

    expect(albumResponse.status).toBe(201);
    const albumId = albumResponse.body?.data?._id;
    expect(albumId).toBeDefined();

    const shareResponse = await request(app)
      .post(`/api/album/${albumId}/share`)
      .set("Cookie", cookieHeader)
      .send({ expiresIn: "7d" });

    expect(shareResponse.status).toBe(201);
    const token = shareResponse.body?.data?.shareLink?.token;
    expect(token).toBeDefined();

    const readResponse = await request(app).get(`/api/share/${token}`);

    expect(readResponse.status).toBe(200);
    expect(readResponse.body).toHaveProperty("data");
  });
});
