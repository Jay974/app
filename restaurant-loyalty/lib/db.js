import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || 'restaurant_loyalty';

let cachedClient = null;

export async function getDb() {
  if (!MONGO_URL) throw new Error('MONGO_URL manquant');
  if (!cachedClient) {
    cachedClient = new MongoClient(MONGO_URL);
    await cachedClient.connect();
  }
  return cachedClient.db(DB_NAME);
}
