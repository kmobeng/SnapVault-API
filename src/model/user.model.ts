import { Document, InferSchemaType, Model, model, Schema } from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import JWT from "jsonwebtoken";
import crypto from "crypto";

export interface IUserMethods {
  signRefreshToken(): string;
  signAccessToken(): string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  createPasswordToken(): string;
}

const UserSchema = new Schema({
  googleId: { type: String, unique: true, default: null },
  name: { type: String, required: [true, "name is required"] },
  email: {
    type: String,
    unique: true,
    required: [true, "email is required"],
    trim: true,
    lowercase: true,
    validate: [validator.isEmail, "Please provide a valid email"],
  },
  password: {
    type: String,
    required: [true, "You must provide password"],
    minlength: [8, "Password is should be 8 characters or more"],
    select: false,
  },
  passwordConfirm: {
    type: String,
    required: [true, "You must confirm password"],
    validate: {
      validator: function (this: any, value: string): boolean {
        return value === this.password;
      },
      message: "Password must match",
    },
  },
  refreshToken: { type: String, default: null, select: false },
  role: { type: String, default: "user", enum: ["user", "admin"] },
  provider: { type: String, default: "local", enum: ["local", "google"] },
  needToChangePassword: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null, select: false },
  emailverificationTokenExpires: { type: Date, default: null, select: false },
  createdAt: { type: Date, default: Date.now },
  passwordChangedAt: Date,
  passwordResetToken: { type: String, default: null, select: false },
  passwordResetExpires: { type: Date, default: null, select: false },
});

UserSchema.pre("save", async function (this: any) {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordConfirm = undefined;
});

UserSchema.pre("save", async function () {
  if (!this.isModified("password") || this.isNew) return;
  this.passwordChangedAt = new Date(Date.now() - 1000);
});

UserSchema.methods.signAccessToken = function () {
  return JWT.sign({ id: this._id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.ACCESS_JWT_EXPIRES_IN!,
  } as JWT.SignOptions);
};

UserSchema.methods.signRefreshToken = function () {
  return JWT.sign({ id: this._id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.REFRESH_JWT_EXPIRES_IN!,
  } as JWT.SignOptions);
}

UserSchema.methods.comparePassword = async function (
  this: IUser,
  candidatePassword: string,
) {
  return await bcrypt.compare(candidatePassword, this.password);
};

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp: any) {
  if (this.passwordChangedAt) {
    const changedTimestamp: any = this.passwordChangedAt.getTime() / 1000;
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

UserSchema.methods.createPasswordToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

type UserSchemaType = InferSchemaType<typeof UserSchema>;

export interface IUser extends UserSchemaType, IUserMethods, Document {}

type UserModel = Model<IUser>;

const User = model<IUser, UserModel>("User", UserSchema);

export default User;
