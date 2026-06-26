import fs from "fs";
import path from "path";
import https from "https";
import { db, client } from "./db.js";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

function download(url, filename) {
  return new Promise((resolve, reject) => {
    const dest = path.join(uploadsDir, filename);
    const file = fs.createWriteStream(dest);
    https.get(url, { rejectUnauthorized: false }, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close(() => resolve(`/uploads/${filename}`));
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  try {
    console.log("Downloading Old Trafford image...");
    const oldTraffordImg = await download("https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200", "old_trafford.jpg");
    console.log("Downloading Stamford image...");
    const stamfordImg = await download("https://images.unsplash.com/photo-1570498839593-e565b39455fc?w=1200", "stamford.jpg");
    console.log("Downloading Wembley image...");
    const wembleyImg = await download("https://images.unsplash.com/photo-1551958219-acbc608c6377?w=1200", "wembley.jpg");
    
    console.log("Downloading Blazes video...");
    const blazesVid = await download("https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", "blazes.mp4");
    console.log("Downloading Fun video...");
    const funVid = await download("https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4", "fun.mp4");
    console.log("Downloading Escape video...");
    const escapeVid = await download("https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscape.mp4", "escape.mp4");

    console.log("Downloading Three place image...");
    const threePlaceImg = await download("https://images.unsplash.com/photo-1541252260730-0412e8e2108e?w=800", "three_place.jpg");

    console.log("Updating database...");
    await db.collection("facilities").updateOne({ name: "Old Trafford Turf" }, { $set: { image_url: oldTraffordImg, video_url: blazesVid, media: { image_url: oldTraffordImg, video_url: blazesVid } } });
    await db.collection("facilities").updateOne({ name: "Stamford Bridge Arena" }, { $set: { image_url: stamfordImg, video_url: funVid, media: { image_url: stamfordImg, video_url: funVid } } });
    await db.collection("facilities").updateOne({ name: "Wembley Training Ground" }, { $set: { image_url: wembleyImg, video_url: escapeVid, media: { image_url: wembleyImg, video_url: escapeVid } } });
    await db.collection("facilities").updateOne({ name: "Three place Photos and video" }, { $set: { image_url: threePlaceImg } });

    console.log("Done!");
  } catch (err) {
    console.error(err);
  } finally {
    await client.close();
  }
}

run();
