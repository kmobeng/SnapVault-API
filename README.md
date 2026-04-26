**Live API URL:** [https://snapvault-api.up.railway.app/](https://snapvault-api.up.railway.app/)

**Interactive API Docs:** [Swagger UI](https://snapvault-api.up.railway.app/api/docs)

# SnapVault

A secure RESTful API for storing and managing photos and albums. Built with Node.js, Express, TypeScript, MongoDB, and Redis.

## Features

- Authentication with access + refresh token cookies (HttpOnly)
- Google OAuth 2.0 login via Passport
- Email verification flow with OTP token and resend endpoint
- Forgot/reset password flow via email
- Automatic access-token refresh via middleware when access token expires
- Single and multi-photo upload (up to 10 files/request) via Cloudinary
- Server-side image compression with Sharp before Cloudinary upload
- Soft delete, trash listing, restore, and permanent delete for photos
- Soft delete, trash listing, restore, and permanent delete for albums
- Album management with user ownership checks
- Add multiple photos to albums with ownership validation and duplicate-safe inserts
- Album single-read includes populated album-photo relations with deleted-photo filtering
- Role-based authorization for admin actions
- Public signup always creates role user accounts (role is server-controlled)
- Input validation with Zod schemas for request bodies across all endpoints
- Redis caching for list/detail reads with SCAN-based cache invalidation on writes
- Scheduled background purge for old soft-deleted photos
- Optional retry queue/worker for failed Cloudinary deletes (BullMQ + exponential backoff)
- Security middleware: Helmet, CORS, and route-level rate limiting
- Interactive API documentation with Swagger (OpenAPI 3.0)
- Structured request logging with Morgan + Winston
- Health endpoint at `GET /api/health`

## Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Runtime    | Node.js + TypeScript                |
| Framework  | Express 5                           |
| Database   | MongoDB (Mongoose)                  |
| Cache      | Redis (ioredis)                     |
| Validation | Zod                                 |
| Storage    | Cloudinary                          |
| Jobs/Queue | node-cron, BullMQ                   |
| Auth       | JWT, Passport.js (Google OAuth 2.0) |
| Email      | Nodemailer                          |
| Docs       | Swagger UI (OpenAPI 3.0)            |
| Logging    | Winston, Morgan                     |

## Getting Started

### Prerequisites

- Node.js v18+
- MongoDB instance
- Redis instance
- Cloudinary account
- Google OAuth credentials

### Installation

```bash
git clone https://github.com/kmobeng/photo-vault.git
cd snapvault
npm install
```

### Environment Variables

Copy .env.example to .env:

```bash
cp .env.example .env
```

Required variables in `.env`:

```env
# Server
PORT=4000
NODE_ENV=development
CLIENT_URL=http://localhost:4000

# Database
DB_URL=mongodb://localhost:27017/snapvault

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret
ACCESS_JWT_EXPIRES_IN=expiration_time
ACCESS_JWT_COOKIE_EXPIRES_IN=expiration_time
REFRESH_JWT_COOKIE_EXPIRES_IN=expiration_time

# Cookie Session (OAuth)
COOKIE_KEY=your_cookie_session_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cloudinary
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email
EMAIL_FROM=SnapVault <noreply@yourdomain.com>

# SendGrid (production)
SENDGRID_USERNAME=apikey
SENDGRID_PASSWORD=your_sendgrid_api_key

# Background photo purge job
PHOTO_PURGE_ENABLED=true

# Cloudinary delete retry queue/worker (BullMQ)
# Defaults are disabled to minimize idle Redis command usage.
CLOUDINARY_DELETE_RETRY_QUEUE_ENABLED=false
CLOUDINARY_DELETE_RETRY_WORKER_ENABLED=false
```

`ACCESS_JWT_COOKIE_EXPIRES_IN` is interpreted in minutes by the code.

`REFRESH_JWT_COOKIE_EXPIRES_IN` is interpreted in days.

`CLOUDINARY_CLOUD_NAME` is currently hardcoded in the project config, so it is not required in `.env` unless you later move it to environment config.

`PHOTO_PURGE_ENABLED` controls whether the scheduler starts at boot.

`CLOUDINARY_DELETE_RETRY_QUEUE_ENABLED` controls whether Cloudinary delete retry jobs are enqueued.

`CLOUDINARY_DELETE_RETRY_WORKER_ENABLED` controls whether the BullMQ worker starts to process queued retry jobs.

BullMQ queue/worker are opt-in and disabled by default to reduce background Redis command usage.

The purge retention window and schedule are currently hardcoded in the server:

- Retention window: 30 days
- Schedule: daily at 02:00 (server time)

> **Development email:** The app sends emails via a local SMTP server on `localhost:1025`. Use [Mailpit](https://mailpit.axllent.org) to catch and inspect emails locally.
>
> **Production email:** Handled automatically via SendGrid using the credentials above.

### Running the Server

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm run start
```

## Security and Access Rules

- Passwords are hashed with bcrypt.
- Public signup ignores client-provided role values and always creates user role accounts.
- Access and refresh tokens are stored in HttpOnly cookies; secure/sameSite are enabled in production.
- On expired/invalid access token, middleware checks refresh token and issues a new access token when valid.
- Password reset and email verification tokens are hashed with SHA-256 before storage.
- Route protections use protect, restrictTo, needToChangePassword, and isEmailVerified middleware.
- Login and reset-password routes are rate-limited.
- API routes are rate-limited.

## API Reference

Base URL: /api

### Auth Routes (/api/auth)

| Method | Endpoint               | Description                                      | Guard                         |
| ------ | ---------------------- | ------------------------------------------------ | ----------------------------- |
| POST   | /signup                | Register a user and send email verification code | Public + loginLimiter         |
| POST   | /login                 | Login with email and password                    | Public + loginLimiter         |
| POST   | /forgot-password       | Send password reset token                        | Public + resetPasswordLimiter |
| POST   | /reset-password/:token | Reset password by token                          | Public + resetPasswordLimiter |
| GET    | /google                | Start Google OAuth                               | Public                        |
| GET    | /google/redirect       | Google OAuth callback                            | Public                        |
| POST   | /verify-email          | Verify email with token in body                  | Auth required                 |
| POST   | /verify-email/request  | Request a new email verification token           | Auth required                 |
| POST   | /logout                | Logout and clear session                         | Auth required                 |

Notes:

- Google OAuth users are created with `needToChangePassword=true`, so they must call `PATCH /api/user/change-password` before accessing routes protected by `needToChangePassword`.
- Refreshed access tokens are delivered via HttpOnly cookies only; they are not included in JSON response bodies.
- Signup role is not configurable by clients; accounts are created as user.
- `GET /api/auth/google/redirect` returns a JSON success payload after Passport callback processing.

Verify email request body:

```json
{
  "emailToken": "12345"
}
```

### User Routes (/api/user)

Global middleware order:

1. protect
2. isEmailVerified
3. apiLimiter

Then:

- PATCH /change-password
- needToChangePassword middleware applies to routes below:
- GET /me
- PATCH /update-me
- Admin only: GET /
- Admin only: GET /:userId
- Admin only: DELETE /:userId

Supported query options for `GET /api/user`:

- `page`, `limit`
- `sort` (comma-separated fields)
- `fields` (select returned fields)
- Mongo comparison filters like `createdAt[gte]`

### Photo Routes (/api)

Global middleware: protect, isEmailVerified, needToChangePassword, apiLimiter

- POST /photo (multipart/form-data, repeated field: photo, max 10 files)
- GET /photo
- GET /photo/trash
- PATCH /photo/:photoId/restore
- DELETE /photo/:photoId/permanent (admin + user)
- GET /photo/:photoId
- PATCH /photo/:photoId
- DELETE /photo/:photoId (soft delete)
- GET /:userId/photo
- GET /:userId/photo/:photoId

Listing endpoints support `page`, `limit`, `sort`, and `fields` query options.

Upload photo payload:

```text
Content-Type: multipart/form-data

photo: file (required, can be sent multiple times)
title: string
description: string
visibility: public | private
```

Notes:

- Request bodies are validated with Zod schemas (title, description, visibility).
- Files are compressed server-side before upload (resize cap: 1920px width, WEBP quality 80).
- Multi-upload uses concurrent Cloudinary uploads and bulk DB insertion.
- Permanent photo delete removes DB records first; failed Cloudinary cleanup is retried asynchronously through BullMQ only when `CLOUDINARY_DELETE_RETRY_QUEUE_ENABLED=true` and `CLOUDINARY_DELETE_RETRY_WORKER_ENABLED=true` (5 attempts, exponential backoff from 5s).

Response note:

- `GET /photo` returns `{ message: "No photos found" }` when no records match.
- `GET /photo/trash` returns `{ message: "No deleted photos found" }` when trash is empty.

### Album Routes (/api)

Global middleware: protect, isEmailVerified, needToChangePassword, apiLimiter

- POST /album
- GET /album
- GET /album/trash
- GET /album/:albumId
- PATCH /album/:albumId
- DELETE /album/:albumId (soft delete)
- PATCH /album/:albumId/restore
- DELETE /album/:albumId/permanent
- PATCH /album/:albumId/addPhotos
- DELETE /album/:albumId/removePhotos
- GET /:userId/album
- GET /:userId/album/:albumId

Listing endpoints support `page`, `limit`, `sort`, and `fields` query options.

Add photos payload for `PATCH /album/:albumId/addPhotos`:

```json
{
  "photoIds": ["photoId1", "photoId2"]
}
```

Notes:

- Photo IDs are validated and must belong to the same user.
- Existing photos in the album are ignored via duplicate-safe insertion.
- Single album responses include populated photo relations via the album virtual relation.

Response shape for `PATCH /album/:albumId/addPhotos`:

```json
{
  "status": "success",
  "data": {
    "_id": "albumId",
    "name": "Album Name",
    "visibility": "private",
    "user": "userId",
    "createdAt": "2026-03-24T10:00:00.000Z"
  }
}
```

## Project Structure

```text
swagger.yaml
src/
  app.ts
  server.ts
  config/
  controller/
  jobs/
  middleware/
  model/
  router/
  services/
  utils/
  validators/
```
