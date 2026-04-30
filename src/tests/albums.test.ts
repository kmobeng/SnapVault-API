import request from "supertest";
import app from "../app";
import { createVerifiedUser, loginAndGetCookies } from "./helpers/auth";

const getCookieHeader = (cookies: string | string[] | undefined) => {
  if (!cookies) {
    throw new Error("Login did not return cookies");
  }
  return Array.isArray(cookies) ? cookies : [cookies];
};

describe("Album flows", () => {
  it("creates an album and adds a photo", async () => {
    const user = await createVerifiedUser();

    const cookies = await loginAndGetCookies(user, "Password123!");

    const uploadResponse = await request(app)
      .post("/api/photo")
      .set("Cookie", cookies)
      .field("title", "Album Photo")
      .field("description", "Photo for album")
      .field("visibility", "public")
      .attach("photo", Buffer.from("fake-image"), {
        filename: "album-photo.png",
        contentType: "image/png",
      });

    expect(uploadResponse.status).toBe(201);
    const createdPhoto = uploadResponse.body?.data?.photo;
    const photoId = Array.isArray(createdPhoto)
      ? createdPhoto[0]?._id
      : createdPhoto?._id;

    expect(photoId).toBeDefined();

    const createAlbumResponse = await request(app)
      .post("/api/album")
      .set("Cookie", cookies)
      .send({
        name: `Album ${Date.now()}`,
        visibility: "public",
      });

    expect(createAlbumResponse.status).toBe(201);
    const albumId = createAlbumResponse.body?.data?._id;
    expect(albumId).toBeDefined();

    const addPhotoResponse = await request(app)
      .patch(`/api/album/${albumId}/addPhotos`)
      .set("Cookie", cookies)
      .send({ photoIds: [photoId] });

    expect(addPhotoResponse.status).toBe(200);

    const albumResponse = await request(app)
      .get(`/api/album/${albumId}`)
      .set("Cookie", cookies);

    expect(albumResponse.status).toBe(200);
    expect(albumResponse.body).toHaveProperty("data");
  });

  it("soft deletes and restores an album", async () => {
    const user = await createVerifiedUser({
      email: `albumdelete${Date.now()}@example.com`,
    });

    const cookies = await loginAndGetCookies(user, "Password123!");

    const createAlbumResponse = await request(app)
      .post("/api/album")
      .set("Cookie", cookies)
      .send({
        name: `Delete Album ${Date.now()}`,
        visibility: "public",
      });

    expect(createAlbumResponse.status).toBe(201);
    const albumId = createAlbumResponse.body?.data?._id;
    expect(albumId).toBeDefined();

    const softDeleteResponse = await request(app)
      .delete(`/api/album/${albumId}`)
      .set("Cookie", cookies);

    expect(softDeleteResponse.status).toBe(200);

    const restoreResponse = await request(app)
      .patch(`/api/album/${albumId}/restore`)
      .set("Cookie", cookies);

    expect(restoreResponse.status).toBe(200);
  });
});
