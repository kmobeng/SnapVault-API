import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.util";
import { loginService, signUpService } from "../services/auth.service";
import User, { IUser } from "../model/user.model";
import sendEmail from "../utils/email.util";
import crypto from "crypto";



export const signUp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, email, username, password, passwordConfirm, role } = req.body;

    const fetchedUser = await signUpService(
      name,
      email,
      username,
      password,
      passwordConfirm,
      role,
    );

    const token = fetchedUser.signToken();

    const user: any = fetchedUser.toObject();
    delete user.password;

    res.status(201).json({ status: "success", token, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const cookieOptions: any = {
      expires: new Date(
        Date.now() +
          Number(process.env.JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000,
      ),
      // secure: true,
      httpOnly: true,
      // sameSite: "strict",
    };

    if (process.env.NODE_ENV === "production") {
      ((cookieOptions.secure = true), (cookieOptions.sameSite = "strict"));
    }
    const { email, password } = req.body;
    if (!email || !password) {
      throw createError("Please enter email and password", 400);
    }

    const fetchedUser = await loginService(email, password);
    const token = fetchedUser.signToken();

    const user: any = fetchedUser.toObject();
    delete user.password;

    res.cookie("token", token);

    res.status(200).json({ status: "success", data: { user } });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(createError("Please enter email", 400));
    }

    const user = await User.findOne({ email });
    if (!user) {
      return next(createError("No user with this email found", 404));
    }

    const resetToken = user.createPasswordResetToken();

    await user.save({ validateBeforeSave: false });

    const resetURL = `${req.protocol}://${req.get(
      "host",
    )}/api/auth/reset-password/${resetToken}`;

    const message = `Forgot your password?\n
Submit a PATCH request with your new password and passwordConfirm to:
${resetURL}

If you didn't forget your password, please ignore this email.`;

    try {
      await sendEmail({
        email: user.email,
        subject: "Your password reset token (valid for 10 minutes)",
        message,
      });
    } catch (error) {
      user.passwordResetToken = null;
      user.passwordResetExpires = null;

      await user.save({ validateBeforeSave: false });

      return next(createError("Error while sending email", 500));
    }
    res.status(200).json({
      status: "success",
      message: "Password reset token sent to email",
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { token } = req.params;

    if (!token) {
      throw createError("Token is required", 400);
    }
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return next(createError("Token is invalid or has expired", 400));
    }

    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;

    await user.save();
    res.status(200).json({ status: "success", message: "Password changed" });
  } catch (error) {
    next(error);
  }
};

export const googleRedirect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // redirect to profile
    res.redirect("/api/user/me");
  } catch (error) {
    next(error);
  }
};
