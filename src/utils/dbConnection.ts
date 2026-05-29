import mongoose from "mongoose";
let isConnected: number;

const connectToDb = async (): Promise<boolean> => {
  if (isConnected) return true;

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI as string, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    isConnected = db.connections[0].readyState;
    console.log("MongoDB Connected");
    return true;
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    return false;
  }
};

export default connectToDb;
