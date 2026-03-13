# Photo Vault API

A secure RESTful API for storing and managing photos and albums. Built with Node.js, Express, TypeScript, MongoDB, and Redis.

## Features

- **Authentication** — JWT via HttpOnly cookies, Google OAuth 2.0, forgot/reset password via email
- **Photos** — Upload to Cloudinary, manage visibility (public/private), view other users' public photos
- **Albums** — Create and organize photos into albums
- **Roles** — `user` and `admin` roles with protected admin-only routes
- **Caching** — Redis caching for frequently accessed data
- **Security** — Helmet, CORS, rate limiting, bcrypt password hashing, SHA-256 hashed reset tokens

---

## Tech Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Runtime   | Node.js + TypeScript                |
| Framework | Express 5                           |
| Database  | MongoDB (Mongoose)                  |
| Cache     | Redis (ioredis)                     |
| Storage   | Cloudinary                          |
| Auth      | JWT, Passport.js (Google OAuth 2.0) |
| Email     | Nodemailer                          |
| Logging   | Winston, Morgan                     |

---

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB instance
- Redis instance
- Cloudinary account
- Google OAuth credentials

### Installation

```bash
git clone https://github.com/your-username/photo-vault.git
cd photo-vault
npm install
```

### Environment Variables

Copy `.env.example` to `.env` in the project root, then replace placeholder values with your real credentials:

```bash
cp .env.example .env
```

Required variables in `.env`:

```env
PORT=4000
NODE_ENV=development

# Database
DB_URL=mongodb://localhost:27017/photo-vault

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d
JWT_COOKIE_EXPIRES_IN=7

# Cookie Session (OAuth only)
COOKIE_KEY=your_cookie_session_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cloudinary
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email
EMAIL_FROM=username@yourdomain.com

# SendGrid (production only)
SENDGRID_USERNAME=apikey
SENDGRID_PASSWORD=your_sendgrid_api_key
```

`CLOUDINARY_CLOUD_NAME` is currently hardcoded in the project config, so it is not required in `.env` unless you later move it to environment config.

> **Development email:** The app sends emails via a local SMTP server on `localhost:1025`. Use [Mailpit](https://mailpit.axllent.org) to catch and inspect emails locally.
>
> **Production email:** Handled automatically via SendGrid using the credentials above.

### Running the Server

```bash
# Development
npm run dev

# Production
npm run start

# Build
npm run build
```

---

## API Reference

### Auth — `/api/auth`

| Method | Endpoint                 | Description                  | Auth   |
| ------ | ------------------------ | ---------------------------- | ------ |
| POST   | `/signup`                | Register a new user          | Public |
| POST   | `/login`                 | Log in with email & password | Public |
| POST   | `/forgot-password`       | Send password reset email    | Public |
| POST   | `/reset-password/:token` | Reset password using token   | Public |
| GET    | `/google`                | Initiate Google OAuth flow   | Public |
| GET    | `/google/redirect`       | Google OAuth callback        | Public |

#### Sign Up

```json
POST /api/auth/signup
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "passwordConfirm": "password123"
}
```

#### Login

```json
POST /api/auth/login
{
  "email": "john@example.com",
  "password": "password123"
}
```

---

### Users — `/api/user`

All user routes require authentication.

| Method | Endpoint           | Description             | Role  |
| ------ | ------------------ | ----------------------- | ----- |
| PATCH  | `/change-password` | Change current password | User  |
| GET    | `/me`              | Get your own profile    | User  |
| PATCH  | `/update-me`       | Update your name        | User  |
| GET    | `/`                | Get all users           | Admin |
| GET    | `/:userId`         | Get a single user       | Admin |
| DELETE | `/:userId`         | Delete a user           | Admin |

> **Note:** Google OAuth users must call `PATCH /change-password` before accessing any other user routes.

---

### Photos — `/api`

All photo routes require authentication.

| Method | Endpoint                  | Description                      |
| ------ | ------------------------- | -------------------------------- |
| POST   | `/photo`                  | Upload a photo                   |
| GET    | `/photo`                  | Get your photos                  |
| GET    | `/photo/:photoId`         | Get a single photo               |
| PATCH  | `/photo/:photoId`         | Update photo title/visibility    |
| DELETE | `/photo/:photoId`         | Delete a photo                   |
| GET    | `/:userId/photo`          | Get another user's public photos |
| GET    | `/:userId/photo/:photoId` | Get a specific public photo      |

#### Upload Photo

```
POST /api/photo
Content-Type: multipart/form-data

photo:        <file>
title:        "My Photo"
description:  "A description"
visibility:   "public" | "private"
albumId:      <optional album ID>
```

---

### Albums — `/api`

All album routes require authentication.

| Method | Endpoint                  | Description               |
| ------ | ------------------------- | ------------------------- |
| POST   | `/album`                  | Create an album           |
| GET    | `/album`                  | Get your albums           |
| GET    | `/album/:albumId`         | Get a single album        |
| PATCH  | `/album/:albumId`         | Update album name         |
| DELETE | `/album/:albumId`         | Delete an album           |
| GET    | `/:userId/album`          | Get another user's albums |
| GET    | `/:userId/album/:albumId` | Get a specific album      |

---

## Project Structure

```
src/
├── app.ts                  # Express app setup
├── server.ts               # Server entry point
├── config/
│   ├── db.config.ts        # MongoDB & Redis connection
│   ├── passport.config.ts  # Google OAuth strategy
│   ├── httpLogger.config.ts
│   └── wiston.config.ts    # Winston logger
├── controller/             # Route handlers
├── middleware/
│   ├── auth.middleware.ts  # protect, restrictTo, needToChangePassword
│   ├── errorHandler.middleware.ts
│   ├── limiter.middleware.ts
│   └── setRoleAdmin.middleware.ts
├── model/                  # Mongoose schemas
├── router/                 # Express routers
├── services/               # Business logic
└── utils/
    ├── APIFeatures.util.ts # Filtering, sorting, pagination
    ├── email.util.ts
    └── error.util.ts
```

---

## Security

- Passwords hashed with **bcrypt**
- JWT stored in **HttpOnly cookies** (secure + sameSite in production)
- Password reset tokens hashed with **SHA-256** before DB storage (valid 10 minutes)
- **Helmet** sets secure HTTP headers
- **Rate limiting** on auth and general API routes
- Role-based access control with `restrictTo` middleware
- Google OAuth users flagged with `needToChangePassword` until they set a real password
