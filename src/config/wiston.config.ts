// import winston from 'winston';

// const levels = {
//   error: 0,
//   warn: 1,
//   info: 2,
//   http: 3,
//   debug: 4,
// };

// const colors = {
//   error: 'red',
//   warn: 'yellow',
//   info: 'blue',
//   http: 'magenta',
//   debug: 'green',
// };

// winston.addColors(colors);

// // Console format with colors
// const consoleFormat = winston.format.combine(
//   winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
//   winston.format.colorize({ all: true }),
//   winston.format.printf(
//     (info) => `${info.timestamp} ${info.level}: ${info.message}`
//   )
// );

// // File format without colors
// const fileFormat = winston.format.combine(
//   winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
//   winston.format.printf(
//     (info) => `${info.timestamp} ${info.level}: ${info.message}`
//   )
// );

// const transports: winston.transport[] = [
//   new winston.transports.Console({
//     format: consoleFormat,
//   }),
//   new winston.transports.File({
//     filename: 'logs/error.log',
//     level: 'error',
//     format: fileFormat,
//   }),
//   new winston.transports.File({
//     filename: 'logs/all.log',
//     format: fileFormat,
//   }),
// ];

// const logger = winston.createLogger({
//   level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
//   levels,
//   transports,
// });

// export default logger;

import winston from "winston";

const isDev = process.env.NODE_ENV === "development";

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: "red",
  warn: "yellow",
  info: "blue",
  http: "magenta",
  debug: "green",
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss:ms" }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Always log to console
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

// Only write to files in production
if (!isDev) {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      format: fileFormat,
    }),
    new winston.transports.File({
      filename: "logs/all.log",
      format: fileFormat,
    }),
  );
}

const logger = winston.createLogger({
  level: isDev ? "debug" : "info", 
  levels,
  transports,
});

export default logger;
