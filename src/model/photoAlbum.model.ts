import mongoose, { InferSchemaType, model } from "mongoose";

const PhotoAlbumSchema = new mongoose.Schema({
  photo: { type: mongoose.Schema.Types.ObjectId, ref: "Photo", required: true },
  album: { type: mongoose.Schema.Types.ObjectId, ref: "Album", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

PhotoAlbumSchema.index({ user: 1, createdAt: -1 });
PhotoAlbumSchema.index({ album: 1, photo: 1 }, { unique: true });
PhotoAlbumSchema.index({ photo: 1, album: 1 });
PhotoAlbumSchema.index({ user: 1, album: 1, createdAt: -1 });
PhotoAlbumSchema.index({ user: 1, photo: 1, createdAt: -1 });

type IPhotoAlbum = InferSchemaType<typeof PhotoAlbumSchema>;

const PhotoAlbum = model<IPhotoAlbum>("PhotoAlbum", PhotoAlbumSchema);

export default PhotoAlbum;
