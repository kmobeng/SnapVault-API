import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.util";
import { loginService, signUpService } from "../services/auth.service";
import User, { IUser } from "../model/user.model";
import sendEmail from "../utils/email.util";
import crypto from "crypto";

export const Token = async (res: Response, user: IUser) => {
  const cookieOptions: any = {
    expires: new Date(
      Date.now() + Number(process.env.ACCESS_JWT_COOKIE_EXPIRES_IN) * 60 * 1000,
    ),
    // secure: true,
    httpOnly: true,
    // sameSite: "strict",
  };

  if (process.env.NODE_ENV === "production") {
    ((cookieOptions.secure = true), (cookieOptions.sameSite = "strict"));
  }

  const accessToken = user.signAccessToken();
  res.cookie("accessToken", accessToken, cookieOptions);

  return accessToken;
};

export const signUp = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { name, email, password, passwordConfirm, role } = req.body;

    const fetchedUser = await signUpService(
      name,
      email,
      password,
      passwordConfirm,
      role,
    );

    const accessToken = await Token(res, fetchedUser);

    const refreshToken = crypto.randomBytes(32).toString("hex");
    fetchedUser.refreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const refreshTokenExpires = new Date(
      Date.now() +
        Number(process.env.REFRESH_JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000,
    );

    fetchedUser.refreshTokenExpires = refreshTokenExpires;

    let RefreshCookieOptions: any = {
      expires: new Date(
        Date.now() +
          Number(process.env.REFRESH_JWT_COOKIE_EXPIRES_IN) *
            24 *
            60 *
            60 *
            1000,
      ),
      // secure: true,
      httpOnly: true,
      // sameSite: "strict",
    };

    if (process.env.NODE_ENV === "production") {
      ((RefreshCookieOptions.secure = true),
        (RefreshCookieOptions.sameSite = "strict"));
    }

    res.cookie("refreshToken", refreshToken, RefreshCookieOptions);

    const verificationToken = crypto.randomInt(10000, 100000).toString();
    fetchedUser.emailVerificationToken = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");

    fetchedUser.emailVerificationTokenExpires = new Date(
      Date.now() + 30 * 60 * 1000,
    );

    await fetchedUser.save({ validateBeforeSave: false });

    const user: any = fetchedUser.toObject();
    delete user.password;
    delete user.emailVerificationToken;
    delete user.emailVerificationTokenExpires;
    delete user.refreshToken;
    delete user.refreshTokenExpires;

    const message = `Welcome to Photo Vault, ${user.name}!
    Please verify your email to access all features of our application with this token: ${verificationToken}

     This token is valid for 30 minutes. If you didn't create an account, please ignore this email.`;

    try {
      await sendEmail({
        email: fetchedUser.email,
        subject: "Your account verification token (valid for 30 minutes)",
        message,
      });
    } catch (error) {
      fetchedUser.emailVerificationToken = null;
      fetchedUser.emailVerificationTokenExpires = null;

      await fetchedUser.save({ validateBeforeSave: false });

      throw createError(
        "Could not send verification email, please try again",
        500,
      );
    }

    res.status(201).json({
      status: "success",
      accessToken,
      message: "Email verification token sent to email",
      data: { user },
    });
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
    const { email, password } = req.body;
    if (!email || !password) {
      throw createError("Please enter email and password", 400);
    }

    const refreshToken = crypto.randomBytes(32).toString("hex");
    const hashedRefreshToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const refreshTokenExpires = new Date(
      Date.now() +
        Number(process.env.REFRESH_JWT_COOKIE_EXPIRES_IN) * 24 * 60 * 60 * 1000,
    );

    const fetchedUser = await loginService(
      email,
      password,
      hashedRefreshToken,
      refreshTokenExpires,
    );

    const accessToken = await Token(res, fetchedUser);

    let RefreshCookieOptions: any = {
      expires: new Date(
        Date.now() +
          Number(process.env.REFRESH_JWT_COOKIE_EXPIRES_IN) *
            24 *
            60 *
            60 *
            1000,
      ),
      // secure: true,
      httpOnly: true,
      // sameSite: "strict",
    };

    if (process.env.NODE_ENV === "production") {
      ((RefreshCookieOptions.secure = true),
        (RefreshCookieOptions.sameSite = "strict"));
    }

    res.cookie("refreshToken", refreshToken, RefreshCookieOptions);

    const user: any = fetchedUser.toObject();
    delete user.password;
    delete user.refreshToken;
    delete user.refreshTokenExpires;

    res.status(200).json({
      status: "success",
      accessToken,
      data: { user },
    });
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

    const resetToken = user.createPasswordToken();

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

      throw createError("Could not send reset email, please try again", 500);
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
    res.status(200).json({
      status: "success",
      message: "Password changed",
    });
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
    const user = req.user as IUser;

    Token(res, user);
    res.status(200).json({
      status: "success",
      message: "Logged in with Google. Please set password to continue.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

export const requestEmailVerify = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // get email from req.user
    const email = req.currentUser.email;
    if (req.currentUser.isEmailVerified === true) {
      throw createError("Email already verified", 400);
    }

    // generate email with crypto package and hash it
    const emailToken = crypto.randomInt(10000, 100000).toString();
    const hashedToken = crypto
      .createHash("sha256")
      .update(emailToken)
      .digest("hex");

    // save token and expiration time

    const saveToken = await User.findByIdAndUpdate(
      req.currentUser._id,
      {
        $set: {
          emailVerificationToken: hashedToken,
          emailVerificationTokenExpires: new Date(Date.now() + 30 * 60 * 1000),
        },
      },
      { new: true },
    );
    // create message and send email

    const message = `Hi ${saveToken!.name.split(" ")[0]}
      Enter this code to verify your email
      ${emailToken}`;
    try {
      await sendEmail({
        email,
        subject: "VERIFY YOUR EMAIL. (THIS CODE IS VALID FOR 30 MINS)",
        message,
      });
    } catch (error) {
      saveToken!.emailVerificationToken = null;
      saveToken!.emailVerificationTokenExpires = null;
      await saveToken!.save({ validateBeforeSave: false });

      throw createError("Error while sending email", 500);
    }
    // send response to user
    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      message: "OTP has been sent to your email",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { emailToken } = req.body;
    if (!emailToken) {
      throw createError("Please provide token", 400);
    }
    const hashedToken = crypto
      .createHash("sha256")
      .update(emailToken.toString())
      .digest("hex");

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationTokenExpires: { $gt: new Date(Date.now()) },
    });

    if (!user) {
      throw createError("Invalid or expired verification token", 404);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationTokenExpires = null;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      accessToken: res.locals.token,
      message: "Email verified!",
    });
  } catch (error) {
    next(error);
  }
};
