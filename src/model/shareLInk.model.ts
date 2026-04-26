import { InferSchemaType, model, Schema } from "mongoose";

const ShareLinkSchema = new Schema({
  album: {
    type: Schema.Types.ObjectId,
    ref: "Album",
    required: [true, "album field is required"],
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: [true, "user field is required"],
  },
  tokenHash: {
    type: String,
    required: [true, "tokenHash field is required"],
    unique: true,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  revokedAt: {
    type: Date,
    default: null,
  },
  createdAt: { type: Date, default: Date.now },
});

ShareLinkSchema.index({ tokenHash: 1 }, { unique: true });
ShareLinkSchema.index({ album: 1, user: 1, createdAt: -1 });
ShareLinkSchema.index({ album: 1, user: 1, revokedAt: 1 });
ShareLinkSchema.index(
  { album: 1, user: 1 },
  {
    unique: true,
    partialFilterExpression: { revokedAt: null },
  },
);

export type IShareLink = InferSchemaType<typeof ShareLinkSchema>;

const ShareLink = model<IShareLink>("ShareLink", ShareLinkSchema);

export default ShareLink;
