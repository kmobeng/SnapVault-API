import request from "supertest";
import app from "../app";
import { createVerifiedUser, loginAndGetCookies } from "./helpers/auth";

const getCookieHeader = (cookies: string | string[] | undefined) => {
  if (!cookies) {
    throw new Error("Login did not return cookies");
  }
  return Array.isArray(cookies) ? cookies : [cookies];
};

describe("Photo flows", () => {
  it("uploads, lists, and fetches a photo", async () => {
    const user = await createVerifiedUser();

    const cookies = await loginAndGetCookies(user, "Password123!");

    const uploadResponse = await request(app)
      .post("/api/photo")
      .set("Cookie", cookies)
      .field("title", "Test Photo")
      .field("description", "Integration test upload")
      .field("visibility", "public")
      .attach("photo", Buffer.from("fake-image"), {
        filename: "photo.png",
        contentType: "image/png",
      });

    expect(uploadResponse.status).toBe(201);
    const createdPhoto = uploadResponse.body?.data?.photo;
    const photoId = Array.isArray(createdPhoto)
      ? createdPhoto[0]?._id
      : createdPhoto?._id;

    expect(photoId).toBeDefined();

    const listResponse = await request(app)
      .get("/api/photo")
      .set("Cookie", cookies);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body).toHaveProperty("data");

    const singleResponse = await request(app)
      .get(`/api/photo/${photoId}`)
      .set("Cookie", cookies);

    expect(singleResponse.status).toBe(200);
    expect(singleResponse.body).toHaveProperty("data");
  });

  it("soft deletes, restores, and permanently deletes a photo", async () => {
    const user = await createVerifiedUser({
      email: `delete${Date.now()}@example.com`,
    });

    const cookies = await loginAndGetCookies(user, "Password123!");

    const uploadResponse = await request(app)
      .post("/api/photo")
      .set("Cookie", cookies)
      .field("title", "Delete Photo")
      .field("description", "Delete flow")
      .field("visibility", "public")
      .attach("photo", Buffer.from("fake-image"), {
        filename: "delete-photo.png",
        contentType: "image/png",
      });

    expect(uploadResponse.status).toBe(201);
    const createdPhoto = uploadResponse.body?.data?.photo;
    const photoId = Array.isArray(createdPhoto)
      ? createdPhoto[0]?._id
      : createdPhoto?._id;

    expect(photoId).toBeDefined();

    const softDeleteResponse = await request(app)
      .delete(`/api/photo/${photoId}`)
      .set("Cookie", cookies);

    expect(softDeleteResponse.status).toBe(200);

    const restoreResponse = await request(app)
      .patch(`/api/photo/${photoId}/restore`)
      .set("Cookie", cookies);

    expect(restoreResponse.status).toBe(200);
    expect(restoreResponse.body).toHaveProperty("data");

    const permanentDeleteResponse = await request(app)
      .delete(`/api/photo/${photoId}/permanent`)
      .set("Cookie", cookies);

    expect(permanentDeleteResponse.status).toBe(200);
  });
});
