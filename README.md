# SportNest API Server

This is the backend for the SportNest sports facility booking management system.

## Environment Variables
- `MONGODB_URI` or `MONGO_URI` - MongoDB connection string
- `JWT_SECRET` - Secret used to sign the custom JWT cookie
- `BETTER_AUTH_SECRET` - Secret used by Better Auth
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `CORS_ORIGINS` - Comma-separated frontend origins allowed for cookie requests
- `BETTER_AUTH_TRUSTED_ORIGINS` - Comma-separated trusted origins for Better Auth

## Technologies Used
- Express
- MongoDB
- Better Auth
- JSON Web Token (JWT)
- Cookie Parser
- CORS

## Available Routes

### Auth Routes
- `ALL /api/auth/*` - Better Auth catch-all endpoint (handles login, registration, social OAuth, etc.)
- `POST /api/auth/jwt` - Generates custom JWT and sets it in an HTTPOnly cookie `jwt_token`
- `POST /api/auth/logout` - Signs out the Better Auth session and clears the custom JWT cookie

### Facilities Routes
- `GET /api/facilities` - List all facilities (supports `search` and `type` queries)
- `GET /api/facilities/my-facilities` - List facilities owned by the current logged-in user (Private)
- `GET /api/facilities/:id` - Fetch details for a specific facility
- `POST /api/facilities` - Create a new sports facility (Private)
- `PUT /api/facilities/:id` - Update sports facility details (Private, Owner only)
- `DELETE /api/facilities/:id` - Delete sports facility (Private, Owner only)

### Bookings Routes
- `GET /api/bookings/my-bookings` - Retrieve current user bookings (Private)
- `POST /api/bookings` - Create a booking (Private)
- `DELETE /api/bookings/:id` - Cancel/delete booking (Private, User only)

## Deployment Notes
- The server exposes `GET /` and `GET /health` for hosting checks.
- Private routes fall back to the Better Auth session if the JWT cookie is missing, which helps keep logged-in users signed in on page reload.
- For production, set `CORS_ORIGINS` and `BETTER_AUTH_TRUSTED_ORIGINS` to your deployed frontend URL so cookies and auth callbacks work correctly.
- Set `BETTER_AUTH_URL` and `PUBLIC_SERVER_URL` to the deployed server origin, not the client origin.
