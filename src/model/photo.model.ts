import { InferSchemaType, model, Schema } from "mongoose";

const PhotoSchema = new Schema({
  title: { type: String, required: [true, "title is required"] },
  description: { type: String },
  visibility: { type: String, enum: ["private", "public"], default: "public" },
  url: String,
  publicId: String,
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: [true, "user field is required"],
  },
  createdAt: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
  deletedAt: Date,
});

PhotoSchema.index({ user: 1, visibility: 1, createdAt: -1 });

export type IPhoto = InferSchemaType<typeof PhotoSchema>;

const Photo = model<IPhoto>("Photo", PhotoSchema);

export default Photo;
