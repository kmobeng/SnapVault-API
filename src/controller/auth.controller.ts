import { Request, Response, NextFunction } from "express";
import { createError } from "../utils/error.util";
import { loginService, signUpService } from "../services/auth.service";
import JWT from "jsonwebtoken";
import User, { IUser } from "../model/user.model";
import sendEmail from "../utils/email.util";
import crypto from "crypto";

declare global {
  namespace Express {
    interface Request {
      user: IUser;
    }
  }
}

interface JWTPayload {
  id: string;
  iat: number;
  exp: number;
}

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
    const { email, password } = req.body;
    if (!email || !password) {
      throw createError("Please enter email and password", 400);
    }

    const fetchedUser = await loginService(email, password);
    const token = fetchedUser.signToken();

    const user: any = fetchedUser.toObject();
    delete user.password;

    res.status(200).json({ status: "success", token, data: { user } });
  } catch (error) {
    next(error);
  }
};

export const protect = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    let token: any;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      throw createError("You are not logged in. Please login to continue", 401);
    }

    const decoded = JWT.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    const currentUser = await User.findById(decoded.id).select("+password");

    if (!currentUser) {
      throw createError("The user with this token does not exist", 404);
    }

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      throw createError("Password changed. Please login again", 400);
    }

    req.user = currentUser;

    next();
  } catch (error) {
    next(error);
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      return next(
        createError("You do not have permission to accesss this action", 403),
      );
    }
    next();
  };
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

// passport.use(new GoogleStrategy({
//     clientID:     process.env.GOOGLE_CLIENT_ID,
//     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
//     callbackURL: "http://localhost:4000/auth/google/callback",
//     passReqToCallback   : true
//   },
//   function(request, accessToken, refreshToken, profile, done) {
//     User.findOrCreate({ googleId: profile.id }, function (err, user) {
//       return done(err, user);
//     });
//   }
// ));
