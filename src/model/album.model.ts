import { InferSchemaType, model, Schema } from "mongoose";

const AlbumSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Album name is required"],
      trim: true,
      unique: true,
    },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    visibility: {
      type: String,
      enum: ["public", "private"],
      default: "private",
    },
    createdAt: { type: Date, default: Date.now },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

AlbumSchema.index({ user: 1, createdAt: -1 });

AlbumSchema.virtual("photos", {
  ref: "PhotoAlbum",
  localField: "_id",
  foreignField: "album",
});

type IAlbum = InferSchemaType<typeof AlbumSchema>;

const Album = model<IAlbum>("Album", AlbumSchema);

export default Album;