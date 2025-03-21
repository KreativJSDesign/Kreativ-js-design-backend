import mongoose from "mongoose";
let isConnected: number;

const connectToDb = async () => {
  if (isConnected) return;

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI as string);
    isConnected = db.connections[0].readyState;
    console.log("MongoDB Connected");
  } catch (err) {
    console.error("MongoDB connection failed:", err);
  }
};

export default connectToDb;
