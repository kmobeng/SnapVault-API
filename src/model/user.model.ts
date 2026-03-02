import { Document, InferSchemaType, Model, model, Schema } from "mongoose";
import validator from "validator";
import bcrypt from "bcrypt";
import JWT from "jsonwebtoken";
import crypto from "crypto";

export interface IUserMethods {
  signToken(): string;
  comparePassword(candidatePassword: string): Promise<boolean>;
  changedPasswordAfter(JWTTimestamp: number): boolean;
  createPasswordResetToken(): string;
}

const UserSchema = new Schema({
  name: { type: String, required: [true, "name is required"] },
  email: {
    type: String,
    unique: true,
    required: [true, "email is required"],
    trim: true,
    lowercase: true,
    validate: {
      validator: function (value: string) {
        return validator.isEmail(value);
      },
      message: "Please provide a valid email",
    },
  },
  username: {
    type: String,
    required: [true, "username is required. Please provide!"],
    unique: true,
    trim: true,
    validate: {
      validator: function (value: string) {
        for (const char of value) {
          if (!validator.isAlphanumeric(char) && char !== "_" && char !== ".") {
            return false;
          }
        }
        if (value[value.length - 1] === ".") {
          return false;
        }
        return true;
      },
      message:
        "invalid username format. username must contain alphabets,numbers,underscore,full-stop and must not end with a full-stop",
    },
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
  role: { type: String, default: "user", enum: ["user", "admin"] },
  passwordChangedAt: Date,
  passwordResetToken: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
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

UserSchema.methods.signToken = function () {
  return JWT.sign({ id: this._id }, process.env.JWT_SECRET!, {
    expiresIn: process.env.JWT_EXPIRES_IN!,
  } as JWT.SignOptions);
};

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

UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  console.log(resetToken, this.passwordResetToken);
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

type UserSchemaType = InferSchemaType<typeof UserSchema>;

export interface IUser extends UserSchemaType, IUserMethods, Document {}

type UserModel = Model<IUser>;

const User = model<IUser, UserModel>("User", UserSchema);

export default User;

