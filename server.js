import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import path from "node:path";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { ObjectId } from "mongodb";
import { fileURLToPath } from "node:url";

import { db } from "./db.js";
import { auth } from "./auth.js";
import { verifyJWT, verifyOwner } from "./middleware.js";

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || "sportnest-jwt-secret-key-2026";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "uploads");

function parseOriginList(value, fallback) {
  if (Array.isArray(value)) {
    return value.map(origin => String(origin).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value.split(",").map(origin => origin.trim()).filter(Boolean);
  }

  if (Array.isArray(fallback)) {
    return fallback.map(origin => String(origin).trim()).filter(Boolean);
  }

  if (typeof fallback === "string") {
    return fallback.split(",").map(origin => origin.trim()).filter(Boolean);
  }

  return [];
}

const allowedOrigins = parseOriginList(
  process.env.CORS_ORIGINS || process.env.CLIENT_ORIGINS || process.env.APP_ORIGIN,
  [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175"
  ]
);

function getServerOrigin(req) {
  if (process.env.PUBLIC_SERVER_URL) {
    return process.env.PUBLIC_SERVER_URL.replace(/\/$/, "");
  }

  return `${req.protocol}://${req.get("host")}`;
}

function toAbsolutePublicUrl(value, req) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.startsWith("//")) {
    return `${req.protocol}:${trimmed}`;
  }

  const base = getServerOrigin(req);
  if (trimmed.startsWith("/")) {
    return `${base}${trimmed}`;
  }

  const normalized = trimmed.replace(/^\.\//, "");
  return `${base}/${normalized}`;
}

function extractFacilityMediaValue(facility, kind) {
  const mapByKind = {
    image: [
      facility?.image_url,
      facility?.imageUrl,
      facility?.photo,
      facility?.photo_url,
      facility?.image,
      facility?.media?.image,
      facility?.media?.image_url,
      facility?.images?.[0],
      facility?.images?.[0]?.url,
      facility?.gallery?.[0],
      facility?.gallery?.[0]?.url,
    ],
    video: [
      facility?.video_url,
      facility?.videoUrl,
      facility?.video,
      facility?.promo_video,
      facility?.promo_video_url,
      facility?.media?.video,
      facility?.media?.video_url,
      facility?.videos?.[0],
      facility?.videos?.[0]?.url,
      facility?.media?.videos?.[0],
      facility?.media?.videos?.[0]?.url,
    ],
  };

  const candidates = mapByKind[kind] || [];

  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (value && typeof value === "object" && typeof value.url === "string" && value.url.trim()) {
      return value.url;
    }
  }

  return "";
}

function extractFacilityImageValue(facility) {
  return extractFacilityMediaValue(facility, "image");
}

function extractFacilityVideoValue(facility) {
  return extractFacilityMediaValue(facility, "video");
}

function normalizeFacilityForResponse(facility, req) {
  const imageValue = extractFacilityImageValue(facility);
  const videoValue = extractFacilityVideoValue(facility);

  return {
    ...facility,
    image_url: toAbsolutePublicUrl(imageValue, req),
    video_url: toAbsolutePublicUrl(videoValue, req),
  };
}

// CORS config allowing credentials for cookie sharing
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));

app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.url}`);
  console.log("Cookies:", req.cookies);
  next();
});

// Custom JWT Synching Endpoint:
// Exchange active Better Auth session for a custom JWT HTTPOnly cookie
app.post("/api/auth/jwt", async (req, res) => {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    console.log("[JWT Sync] Session:", session);
    if (!session || !session.user) {
      return res.status(401).json({ message: "No active session found" });
    }

    const user = session.user;
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("jwt_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.json({ success: true, user });
  } catch (error) {
    console.error("JWT sync error:", error);
    return res.status(500).json({ message: "Error generating JWT token", error: error.message });
  }
});

// Custom Logout: Clear both the JWT and Better Auth cookies
app.post("/api/auth/logout", async (req, res) => {
  try {
    await auth.api.signOut({ headers: fromNodeHeaders(req.headers) });
  } catch (error) {
    console.warn("Better Auth sign-out request failed, continuing with local cookie cleanup:", error?.message || error);
  }

  res.clearCookie("jwt_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
  });
  return res.json({ success: true, message: "Logged out successfully" });
});

// Mount Better Auth handler BEFORE express.json() body parsing
app.all("/api/auth/*", (req, res) => {
  return toNodeHandler(auth)(req, res);
});

// JSON & URL Encoded parsers for general API routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// FACILITIES API
// ==========================================

// GET /api/facilities - Public List (with search & filter)
app.get("/api/facilities", async (req, res) => {
  const { search, type } = req.query;
  const query = {};

  if (search) {
    query.name = { $regex: search, $options: "i" };
  }

  if (type) {
    const types = Array.isArray(type) ? type : type.split(",").map(t => t.trim()).filter(Boolean);
    if (types.length > 0) {
      query.facility_type = { $in: types };
    }
  }

  try {
    const facilities = await db.collection("facilities").find(query).toArray();
    return res.json(facilities.map(facility => normalizeFacilityForResponse(facility, req)));
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve facilities", error: error.message });
  }
});

// GET /api/facilities/my-facilities - Private (owner's facilities)
app.get("/api/facilities/my-facilities", verifyJWT, async (req, res) => {
  try {
    const email = req.user.email;
    const facilities = await db.collection("facilities").find({ owner_email: email }).toArray();
    return res.json(facilities.map(facility => normalizeFacilityForResponse(facility, req)));
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve your facilities", error: error.message });
  }
});

// GET /api/facilities/:id - Public Detail
app.get("/api/facilities/:id", async (req, res) => {
  const { id } = req.params;
  try {
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }
    const facility = await db.collection("facilities").findOne({ _id: new ObjectId(id) });
    if (!facility) {
      return res.status(404).json({ message: "Facility not found" });
    }
    return res.json(normalizeFacilityForResponse(facility, req));
  } catch (error) {
    return res.status(500).json({ message: "Error fetching facility details", error: error.message });
  }
});

// POST /api/facilities - Private (create new facility)
app.post("/api/facilities", verifyJWT, async (req, res) => {
  const { name, facility_type, location, price_per_hour, capacity, available_slots, description, image_url, video_url, images, videos } = req.body;

  if (!name || !facility_type || !location || !price_per_hour || !capacity || !available_slots || !description) {
    return res.status(400).json({ message: "Please fill all required fields" });
  }

  try {
    const newFacility = {
      name,
      facility_type,
      location,
      price_per_hour: parseFloat(price_per_hour),
      capacity: parseInt(capacity),
      available_slots: Array.isArray(available_slots) ? available_slots : available_slots.split(",").map(s => s.trim()),
      description,
      image_url: image_url || (images && images.length > 0 ? images[0] : "https://images.unsplash.com/photo-1541252260730-0412e8e2108e?w=800"),
      video_url: video_url || (videos && videos.length > 0 ? videos[0] : ""),
      images: images || (image_url ? [image_url] : []),
      videos: videos || (video_url ? [video_url] : []),
      owner_email: req.user.email,
      booking_count: 0,
      created_at: new Date()
    };

    const result = await db.collection("facilities").insertOne(newFacility);
    return res.status(201).json({ message: "Facility created successfully", facilityId: result.insertedId });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create facility", error: error.message });
  }
});

// PUT /api/facilities/:id - Private (owner update)
app.put("/api/facilities/:id", verifyJWT, verifyOwner, async (req, res) => {
  const { name, facility_type, location, price_per_hour, capacity, available_slots, description, image_url, video_url, images, videos } = req.body;

  try {
    const updatedFields = {};
    if (name) updatedFields.name = name;
    if (facility_type) updatedFields.facility_type = facility_type;
    if (location) updatedFields.location = location;
    if (price_per_hour) updatedFields.price_per_hour = parseFloat(price_per_hour);
    if (capacity) updatedFields.capacity = parseInt(capacity);
    if (available_slots) {
      updatedFields.available_slots = Array.isArray(available_slots) ? available_slots : available_slots.split(",").map(s => s.trim());
    }
    if (description) updatedFields.description = description;
    if (image_url) updatedFields.image_url = image_url;
    if (video_url) updatedFields.video_url = video_url;
    if (images) updatedFields.images = images;
    if (videos) updatedFields.videos = videos;

    await db.collection("facilities").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updatedFields }
    );

    return res.json({ message: "Facility updated successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update facility", error: error.message });
  }
});

// DELETE /api/facilities/:id - Private (owner delete)
app.delete("/api/facilities/:id", verifyJWT, verifyOwner, async (req, res) => {
  try {
    await db.collection("facilities").deleteOne({ _id: new ObjectId(req.params.id) });
    // Also remove bookings related to this facility
    await db.collection("bookings").deleteMany({ facility_id: new ObjectId(req.params.id) });
    return res.json({ message: "Facility deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete facility", error: error.message });
  }
});

// ==========================================
// BOOKINGS API
// ==========================================

// GET /api/bookings/my-bookings - Private (list current user bookings)
app.get("/api/bookings/my-bookings", verifyJWT, async (req, res) => {
  try {
    const bookings = await db.collection("bookings").aggregate([
      { $match: { user_email: req.user.email } },
      {
        $lookup: {
          from: "facilities",
          localField: "facility_id",
          foreignField: "_id",
          as: "facility"
        }
      },
      { $unwind: { path: "$facility", preserveNullAndEmptyArrays: true } }
    ]).toArray();

    const normalizedBookings = bookings.map(booking => ({
      ...booking,
      facility: booking.facility ? normalizeFacilityForResponse(booking.facility, req) : booking.facility
    }));

    return res.json(normalizedBookings);
  } catch (error) {
    return res.status(500).json({ message: "Failed to retrieve bookings", error: error.message });
  }
});

// POST /api/bookings - Private (create booking)
app.post("/api/bookings", verifyJWT, async (req, res) => {
  const { facility_id, booking_date, time_slot, hours } = req.body;

  if (!facility_id || !booking_date || !time_slot || !hours) {
    return res.status(400).json({ message: "Missing required booking details" });
  }

  try {
    if (!ObjectId.isValid(facility_id)) {
      return res.status(400).json({ message: "Invalid facility ID format" });
    }

    const facility = await db.collection("facilities").findOne({ _id: new ObjectId(facility_id) });
    if (!facility) {
      return res.status(404).json({ message: "Facility not found" });
    }

    // Check if slot is already booked for this facility on this date
    const existingBooking = await db.collection("bookings").findOne({
      facility_id: new ObjectId(facility_id),
      booking_date,
      time_slot,
      status: { $ne: "cancelled" }
    });

    if (existingBooking) {
      return res.status(409).json({ message: "This time slot is already booked for the selected date." });
    }

    const total_price = facility.price_per_hour * parseFloat(hours);

    const newBooking = {
      facility_id: new ObjectId(facility_id),
      user_email: req.user.email,
      booking_date,
      time_slot,
      hours: parseFloat(hours),
      total_price,
      status: "pending",
      created_at: new Date()
    };

    const result = await db.collection("bookings").insertOne(newBooking);

    // Increment booking count for the facility
    await db.collection("facilities").updateOne(
      { _id: new ObjectId(facility_id) },
      { $inc: { booking_count: 1 } }
    );

    return res.status(201).json({
      message: "Booking successful",
      bookingId: result.insertedId,
      totalPrice: total_price
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to book facility", error: error.message });
  }
});

// DELETE /api/bookings/:id - Private (cancel booking)
app.delete("/api/bookings/:id", verifyJWT, async (req, res) => {
  const { id } = req.params;

  try {
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid booking ID format" });
    }

    const booking = await db.collection("bookings").findOne({ _id: new ObjectId(id) });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }

    if (booking.user_email !== req.user.email) {
      return res.status(403).json({ message: "Forbidden: You cannot cancel someone else's booking" });
    }

    await db.collection("bookings").deleteOne({ _id: new ObjectId(id) });

    // Decrement booking count for the facility
    await db.collection("facilities").updateOne(
      { _id: booking.facility_id },
      { $inc: { booking_count: -1 } }
    );

    return res.json({ message: "Booking cancelled successfully" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to cancel booking", error: error.message });
  }
});

app.get("/", (req, res) => {
  return res.json({
    success: true,
    message: "SportNest API is running"
  });
});

app.get("/health", (req, res) => {
  return res.json({ success: true });
});

app.use((req, res) => {
  return res.status(404).json({
    message: "Route not found"
  });
});

// Start the server
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`SportNest Server is running on port ${PORT}`);
  });
}

export default app;
