# Photo Vault API

A secure RESTful API for storing and managing photos and albums. Built with Node.js, Express, TypeScript, MongoDB, and Redis.

## Features

- Authentication with JWT in HttpOnly cookies
- Google OAuth 2.0 login via Passport
- Email verification flow with OTP token and resend endpoint
- Forgot/reset password flow via email
- Photo upload and storage via Cloudinary
- Album management with user ownership checks
- Role-based authorization for admin actions
- Redis cache invalidation for user-list updates
- Security middleware: Helmet, CORS, and route-level rate limiting
- Structured request logging with Morgan + Winston

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

Copy .env.example to .env:

```bash
cp .env.example .env
```

Required variables in `.env`:

```env
# Server
PORT=4000
NODE_ENV=development

# Database
DB_URL=mongodb://localhost:27017/photo-vault

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret
ACCESS_JWT_EXPIRES_IN=7d
ACCESS_JWT_COOKIE_EXPIRES_IN=7

# Cookie Session (OAuth)
COOKIE_KEY=your_cookie_session_key

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cloudinary
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Email
EMAIL_FROM=Photo Vault <noreply@yourdomain.com>

# SendGrid (production)
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

# Build
npm run build

# Production
npm run start
```

## Security and Access Rules

- Passwords are hashed with bcrypt.
- JWT is stored in HttpOnly cookie; secure/sameSite are enabled in production.
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

### Photo Routes (/api)

Global middleware: protect, isEmailVerified, needToChangePassword, apiLimiter

- POST /photo (multipart/form-data, field: photo)
- GET /photo
- GET /photo/:photoId
- PATCH /photo/:photoId
- DELETE /photo/:photoId
- GET /:userId/photo
- GET /:userId/photo/:photoId
- Admin only: DELETE /:userId/photo/:photoId

Upload photo payload:

```text
Content-Type: multipart/form-data

photo: file (required)
title: string
description: string
visibility: public | private
albumId: optional
```

### Album Routes (/api)

Global middleware: protect, isEmailVerified, needToChangePassword, apiLimiter

- POST /album
- GET /album
- GET /album/:albumId
- PATCH /album/:albumId
- DELETE /album/:albumId
- GET /:userId/album
- GET /:userId/album/:albumId

## Project Structure

```text
src/
  app.ts
  server.ts
  config/
  controller/
  middleware/
  model/
  router/
  services/
  utils/
```
