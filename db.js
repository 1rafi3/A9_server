import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import dns from "node:dns";
import { fileURLToPath } from "node:url";

dotenv.config({ path: fileURLToPath(new URL(".env", import.meta.url)) });

const mongoUri = (process.env.MONGODB_URI || process.env.MONGO_URI || "").trim();

if (!mongoUri) {
  throw new Error("Missing MongoDB connection string. Set MONGODB_URI in the .env file.");
}

if (mongoUri.startsWith("mongodb+srv://")) {
  const dnsServers = (process.env.MONGODB_DNS_SERVERS || "8.8.8.8,1.1.1.1")
    .split(",")
    .map(server => server.trim())
    .filter(Boolean);

  dns.setServers(dnsServers);
}

console.log("Connecting to MongoDB URI:", mongoUri.replace(/:([^@]+)@/, ":****@"));

const client = new MongoClient(mongoUri, {
  serverSelectionTimeoutMS: 10000,
});

// Connect once top-level to ensure the database is ready when imported
// await client.connect();
console.log("Successfully connected to MongoDB");

export const db = client.db();

// Auto seed default facilities if collection is empty
try {
  const facilitiesCol = db.collection("facilities");
  const count = await facilitiesCol.countDocuments();
  if (count === 0) {
    console.log("Seeding default sports facilities...");
    const defaultFacilities = [
      {
        name: "Old Trafford Turf",
        facility_type: "Football Turf",
        image_url: "https://i.ibb.co.com/fzxHthdN/old-trafford-1959155-1280.jpg",
        location: "Manchester, UK",
        price_per_hour: 75.00,
        capacity: 14,
        available_slots: ["08:00-09:00", "09:00-10:00", "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00"],
        description: "A premium, FIFA-standard 7-a-side artificial turf pitch featuring floodlights, player dugout, and adjacent shower facilities.",
        owner_email: "seed-owner@sportnest.com",
        booking_count: 12
      },
      {
        name: "Smash Badminton Club",
        facility_type: "Badminton Court",
        image_url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800",
        location: "Kuala Lumpur, Malaysia",
        price_per_hour: 20.00,
        capacity: 4,
        available_slots: ["07:00-08:00", "08:00-09:00", "09:00-10:00", "15:00-16:00", "16:00-17:00", "17:00-18:00", "20:00-21:00"],
        description: "Professional grade indoor wooden court with premium anti-slip mats. Perfect for singles or doubles. Racquets available for hire.",
        owner_email: "seed-owner@sportnest.com",
        booking_count: 45
      },
      {
        name: "Wimbledon Arena",
        facility_type: "Tennis Court",
        image_url: "https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?w=800",
        location: "London, UK",
        price_per_hour: 45.00,
        capacity: 4,
        available_slots: ["09:00-10:00", "10:00-11:00", "11:00-12:00", "14:00-15:00", "15:00-16:00", "16:00-17:00"],
        description: "Impeccably maintained grass court matching Wimbledon specifications. Provides excellent ball bounce and court speed.",
        owner_email: "seed-owner@sportnest.com",
        booking_count: 8
      },
      {
        name: "Olympic Aquatic Center",
        facility_type: "Swimming Lane",
        image_url: "https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800",
        location: "Sydney, Australia",
        price_per_hour: 15.00,
        capacity: 2,
        available_slots: ["06:00-07:00", "07:00-08:00", "08:00-09:00", "11:00-12:00", "12:00-13:00", "18:00-19:00"],
        description: "Temperature-controlled 50-meter Olympic size pool. The lane booking is perfect for individual lap swimming and speed endurance training.",
        owner_email: "seed-owner@sportnest.com",
        booking_count: 31
      },
      {
        name: "Madison Square Arena",
        facility_type: "Basketball Court",
        image_url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
        location: "New York, USA",
        price_per_hour: 60.00,
        capacity: 10,
        available_slots: ["10:00-11:00", "11:00-12:00", "15:00-16:00", "17:00-18:00", "18:00-19:00", "21:00-22:00"],
        description: "Indoor polished maple wood basketball court. Equipped with professional breakaway rims, height-adjustable backboards, and scoreboard.",
        owner_email: "seed-owner@sportnest.com",
        booking_count: 19
      },
      {
        name: "Stamford Bridge Arena",
        facility_type: "Football Turf",
        image_url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
        location: "London, UK",
        price_per_hour: 80.00,
        capacity: 14,
        available_slots: ["08:00-09:00", "10:00-11:00", "15:00-16:00", "16:00-17:00", "18:00-19:00", "20:00-21:00", "21:00-22:00"],
        description: "Top-tier hybrid turf pitch designed for 5-a-side and 7-a-side matches. Fully enclosed netting prevents ball exit.",
        owner_email: "seed-owner@sportnest.com",
        booking_count: 24
      }
    ];
    await facilitiesCol.insertMany(defaultFacilities);
    console.log("Default facilities seeded successfully.");
  }

  const featuredShowcaseFacilities = [
    {
      name: "Old Trafford Turf",
      facility_type: "Football Turf",
      location: "Manchester, UK",
      price_per_hour: 75.0,
      capacity: 14,
      available_slots: ["08:00-09:00", "09:00-10:00", "16:00-17:00", "17:00-18:00", "18:00-19:00", "19:00-20:00", "20:00-21:00"],
      description: "A premium, FIFA-standard 7-a-side artificial turf pitch featuring floodlights, player dugout, and adjacent shower facilities.",
      owner_email: "seed-owner@sportnest.com",
      booking_count: 12,
      image_url: "https://i.ibb.co.com/fzxHthdN/old-trafford-1959155-1280.jpg",
      video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    },
    {
      name: "Stamford Bridge Arena",
      facility_type: "Football Turf",
      location: "London, UK",
      price_per_hour: 80.0,
      capacity: 14,
      available_slots: ["08:00-09:00", "10:00-11:00", "15:00-16:00", "16:00-17:00", "18:00-19:00", "20:00-21:00", "21:00-22:00"],
      description: "Top-tier hybrid turf pitch designed for 5-a-side and 7-a-side matches. Fully enclosed netting prevents ball exit.",
      owner_email: "seed-owner@sportnest.com",
      booking_count: 24,
      image_url: "https://images.unsplash.com/photo-1570498839593-e565b39455fc?w=1200",
      video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
    },
    {
      name: "Wembley Training Ground",
      facility_type: "Football Turf",
      location: "London, UK",
      price_per_hour: 95.0,
      capacity: 16,
      available_slots: ["07:00-08:00", "08:00-09:00", "09:00-10:00", "17:00-18:00", "18:00-19:00", "19:00-20:00"],
      description: "Elite football training complex with hybrid grass, performance tracking cameras, and modern locker-room amenities.",
      owner_email: "seed-owner@sportnest.com",
      booking_count: 6,
      image_url: "https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200",
      video_url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscape.mp4",
    },
  ];

  const showcaseOps = featuredShowcaseFacilities.map(facility => {
    const { image_url, video_url, ...insertOnlyFields } = facility;

    return {
      updateOne: {
        filter: { name: facility.name },
        update: {
          $set: {
            image_url,
            video_url,
            media: {
              image_url,
              video_url,
            },
          },
          $setOnInsert: {
            ...insertOnlyFields,
            created_at: new Date(),
          },
        },
        upsert: true,
      },
    };
  });

  await facilitiesCol.bulkWrite(showcaseOps, { ordered: false });
  console.log("Showcase facility media fields ensured successfully.");
} catch (err) {
  console.error("Failed to seed default facilities:", err);
}

export { client };

