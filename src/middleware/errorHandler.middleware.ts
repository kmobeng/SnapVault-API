import { Request, Response, NextFunction } from "express";
import logger from "../config/wiston.config";
import multer from "multer";

const sendErrorDev = (err: any, res: Response) => {
  res.status(err.statusCode).json({
    status: "fail",
    error: err.errorMessage,
    name: err.name,
    message: err.message,
    stack: err.stack,
    raw: err,
  });
};

const sendErrorProd = (err: any, res: Response) => {
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: "fail",
      error: err.errorMessage,
    });
  }

  res.status(err.statusCode).json({
    status: "error",
    error: "Something went wrong. Please try again later.",
  });
};

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let statusCode = err.statusCode || err.status || 500;
  let errorMessage = err.errorMessage || "Internal server error";
  let isOperational = Boolean(err.isOperational);

  if (err.code === 11000) {
    statusCode = 400;
    isOperational = true;
    const duplicateField = Object.keys(err.keyPattern || {})[0];
    const duplicateValue = duplicateField
      ? err.keyValue?.[duplicateField]
      : undefined;

    errorMessage = duplicateField
      ? `${duplicateField}: ${duplicateValue} already exists. Please use a different value.`
      : "Duplicate value already exists. Please use a different value.";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    isOperational = true;
    const errors = Object.values(err.errors).map((el: any) => el.message);
    errorMessage = errors.join(", ");
  }

  if (err.name === "CastError") {
    statusCode = 400;
    isOperational = true;
    errorMessage = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    isOperational = true;
    errorMessage = "Invalid token. Please login again.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    isOperational = true;
    errorMessage = "Token expired. Please login again.";
  }

  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    isOperational = true;
    errorMessage = "File too large. Max 10MB";
  }

  if (err.code === "LIMIT_FILE_COUNT") {
    statusCode = 400;
    isOperational = true;
    errorMessage = "Too many files. Max 10";
  }

  err.statusCode = statusCode;
  err.errorMessage = errorMessage;
  err.isOperational = isOperational;

  if (process.env.NODE_ENV === "development") {
    sendErrorDev(err, res);
  } else {
    if (!err.isOperational) {
      logger.error(err.message || "Unhandled server error", {
        name: err.name,
        statusCode: err.statusCode,
        stack: err.stack,
      });
    }
    sendErrorProd(err, res);
  }
};
