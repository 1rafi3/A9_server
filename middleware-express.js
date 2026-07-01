import jwt from "jsonwebtoken";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "./auth.js";
import { db } from "./db.js";
import { ObjectId } from "mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "sportnest-jwt-secret-key-2026";

export async function verifyJWT(req, res, next) {
  const token = req.cookies.jwt_token;

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      return next();
    } catch (err) {
      console.warn("JWT Verification failed, checking Better Auth session fallback...");
    }
  }

  // Fallback: Check Better Auth Session directly
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (session && session.user) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      };
      return next();
    }
  } catch (err) {
    console.error("Better Auth session verification failed:", err);
  }

  return res.status(401).json({ message: "Unauthorized: Please log in." });
}

export async function verifyOwner(req, res, next) {
  const { id } = req.params;
  const userEmail = req.user?.email;

  if (!userEmail) {
    return res.status(401).json({ message: "Unauthorized: No email associated with user" });
  }

  try {
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid facility ID format" });
    }

    const facility = await db.collection("facilities").findOne({ _id: new ObjectId(id) });
    if (!facility) {
      return res.status(404).json({ message: "Facility not found" });
    }

    if (facility.owner_email !== userEmail) {
      return res.status(403).json({ message: "Forbidden: You are not the owner of this facility" });
    }

    req.facility = facility;
    next();
  } catch (err) {
    return res.status(500).json({ message: "Server error during owner verification", error: err.message });
  }
}
