import mongoose from 'mongoose';

let isConnected = false;

export const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables');
    return false;
  }

  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('Connection string starts with:', process.env.MONGODB_URI.substring(0, 20) + '...');

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    console.log('Database name:', conn.connection.name);
    return true;

  } catch (error) {
    console.error('MongoDB connection error details:', {
      name: error.name,
      message: error.message,
      code: error.code,
      errorType: error.constructor.name,
      // Log the full error for debugging
      fullError: error
    });

    if (error.code === 18) {
      console.error('Authentication failed - please verify username and password');
    } else if (error.code === 8000) {
      console.error('Wrong credential format or invalid characters in password');
    }

    return false;
  }
};
