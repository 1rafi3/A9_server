import { db, client } from "./db.js";

async function run() {
  const facilities = await db.collection("facilities").find({}).toArray();
  console.log(JSON.stringify(facilities, null, 2));
  await client.close();
}

run();
