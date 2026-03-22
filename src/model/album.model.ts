import { InferSchemaType, model, Schema } from "mongoose";
import Photo from "./photo.model";

const AlbumSchema = new Schema({
  name: {
    type: String,
    required: [true, "Album name is required"],
    trim: true,
    unique: true,
  },
  photos: [{ type: Schema.Types.ObjectId, ref: "Photo" }],
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
});

AlbumSchema.index({ user: 1, createdAt: -1 });

type IAlbum = InferSchemaType<typeof AlbumSchema>;

const Album = model<IAlbum>("Album", AlbumSchema);

export default Album;
