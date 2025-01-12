import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.log('MongoDB URI not found - skipping database connection');
    return false;
  }

  if (isConnected) {
    console.log('Using existing database connection');
    return true;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = true;
    console.log('MongoDB connected successfully');
    return true;
  } catch (error) {
    console.log('MongoDB connection error:', error.message);
    return false;
  }
};
