// MongoDB sync utility for backup purposes
// This keeps MongoDB in sync with PostgreSQL as a read-only backup

import prisma from './database';
const mongoose = require('mongoose');

// MongoDB connection
let mongoConnection: any = null;

const connectMongo = async () => {
  if (!mongoConnection) {
    try {
      await mongoose.connect(process.env.MONGODB_URI || '', {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      mongoConnection = mongoose.connection;
      console.log('✅ MongoDB backup connected');
    } catch (error) {
      console.error('❌ MongoDB backup connection failed:', error);
    }
  }
  return mongoConnection;
};

// User sync
export const syncUserToMongo = async (user: any) => {
  try {
    await connectMongo();
    
    const User = mongoose.model('User', new mongoose.Schema({
      _id: String,
      email: String,
      firstName: String,
      lastName: String,
      phone: String,
      role: String,
      isVerified: Boolean,
      isEmailVerified: Boolean,
      isPhoneVerified: Boolean,
      isIdentityVerified: Boolean,
      skills: [String],
      experienceYears: Number,
      isOnline: Boolean,
      rating: Number,
      totalReviews: Number,
      availability: mongoose.Schema.Types.Mixed,
      serviceArea: mongoose.Schema.Types.Mixed,
      location: mongoose.Schema.Types.Mixed,
      profileImage: String,
      walletBalance: Number,
      status: String,
      favouriteProviders: [String],
      totalBookings: Number,
      ratingGivenAvg: Number,
      verificationToken: String,
      verificationExpires: Date,
      isProfileComplete: Boolean,
      lastLoginAt: Date,
      createdAt: Date,
      updatedAt: Date
    }));

    const mongoUser = {
      _id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      isIdentityVerified: user.isIdentityVerified,
      skills: user.skills || [],
      experienceYears: user.experienceYears || 0,
      isOnline: user.isOnline || false,
      rating: user.rating || 0,
      totalReviews: user.totalReviews || 0,
      availability: user.availability,
      serviceArea: {
        radiusInKm: user.serviceAreaRadius || 0,
        baseLocation: user.serviceAreaCenter || { type: 'Point', coordinates: [0, 0] }
      },
      location: user.location,
      profileImage: user.profileImage || '',
      walletBalance: user.walletBalance || 0,
      status: user.status || 'active',
      favouriteProviders: user.favouriteProviders || [],
      totalBookings: user.totalBookings || 0,
      ratingGivenAvg: user.ratingGivenAvg || 0,
      verificationToken: user.verificationToken,
      verificationExpires: user.verificationExpires,
      isProfileComplete: user.isProfileComplete || false,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    await User.findOneAndUpdate(
      { _id: user.id },
      mongoUser,
      { upsert: true, new: true }
    );

    console.log(`✅ Synced user ${user.id} to MongoDB`);
  } catch (error) {
    console.error('❌ Failed to sync user to MongoDB:', error);
  }
};

// Booking sync
export const syncBookingToMongo = async (booking: any) => {
  try {
    await connectMongo();
    
    const Booking = mongoose.model('Booking', new mongoose.Schema({
      _id: String,
      customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
      date: Date,
      time: String,
      location: mongoose.Schema.Types.Mixed,
      notes: String,
      status: String,
      estimatedDurationMinutes: Number,
      startedAt: Date,
      completedAt: Date,
      slaBreached: Boolean,
      providerLiveLocation: mongoose.Schema.Types.Mixed,
      customerLiveLocation: mongoose.Schema.Types.Mixed,
      rating: Number,
      review: String,
      createdAt: Date,
      updatedAt: Date
    }));

    const mongoBooking = {
      _id: booking.id,
      customer: booking.customerId,
      service: booking.serviceId,
      date: booking.date,
      time: booking.time,
      location: booking.location,
      notes: booking.notes,
      status: booking.status,
      estimatedDurationMinutes: booking.estimatedDurationMinutes,
      startedAt: booking.startedAt,
      completedAt: booking.completedAt,
      slaBreached: booking.slaBreached,
      providerLiveLocation: booking.providerLiveLocation,
      customerLiveLocation: booking.customerLiveLocation,
      rating: booking.rating,
      review: booking.review,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt
    };

    await Booking.findOneAndUpdate(
      { _id: booking.id },
      mongoBooking,
      { upsert: true, new: true }
    );

    console.log(`✅ Synced booking ${booking.id} to MongoDB`);
  } catch (error) {
    console.error('❌ Failed to sync booking to MongoDB:', error);
  }
};

// Service sync
export const syncServiceToMongo = async (service: any) => {
  try {
    await connectMongo();
    
    const Service = mongoose.model('Service', new mongoose.Schema({
      _id: String,
      title: String,
      description: String,
      category: String,
      price: Number,
      duration: Number,
      provider: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      mediaUrl: String,
      status: String,
      createdAt: Date,
      updatedAt: Date
    }));

    const mongoService = {
      _id: service.id,
      title: service.title,
      description: service.description,
      category: service.category,
      price: service.price,
      duration: service.duration,
      provider: service.providerId,
      mediaUrl: service.mediaUrl,
      status: service.status,
      createdAt: service.createdAt,
      updatedAt: service.updatedAt
    };

    await Service.findOneAndUpdate(
      { _id: service.id },
      mongoService,
      { upsert: true, new: true }
    );

    console.log(`✅ Synced service ${service.id} to MongoDB`);
  } catch (error) {
    console.error('❌ Failed to sync service to MongoDB:', error);
  }
};

// Payment sync
export const syncPaymentToMongo = async (payment: any) => {
  try {
    await connectMongo();
    
    const Payment = mongoose.model('Payment', new mongoose.Schema({
      _id: String,
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
      amount: Number,
      currency: String,
      paymentMethod: String,
      status: String,
      transactionId: String,
      createdAt: Date,
      updatedAt: Date
    }));

    const mongoPayment = {
      _id: payment.id,
      user: payment.userId,
      booking: payment.bookingId,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      transactionId: payment.transactionId,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt
    };

    await Payment.findOneAndUpdate(
      { _id: payment.id },
      mongoPayment,
      { upsert: true, new: true }
    );

    console.log(`✅ Synced payment ${payment.id} to MongoDB`);
  } catch (error) {
    console.error('❌ Failed to sync payment to MongoDB:', error);
  }
};

// Full sync function
export const fullSyncToMongo = async () => {
  try {
    console.log('🔄 Starting full sync to MongoDB...');
    
    // Sync users
    const users = await prisma.user.findMany();
    for (const user of users) {
      await syncUserToMongo(user);
    }
    
    // Sync services
    const services = await prisma.service.findMany();
    for (const service of services) {
      await syncServiceToMongo(service);
    }
    
    // Sync bookings
    const bookings = await prisma.booking.findMany();
    for (const booking of bookings) {
      await syncBookingToMongo(booking);
    }
    
    // Sync payments
    const payments = await prisma.payment.findMany();
    for (const payment of payments) {
      await syncPaymentToMongo(payment);
    }
    
    console.log('✅ Full sync to MongoDB completed');
  } catch (error) {
    console.error('❌ Full sync to MongoDB failed:', error);
  }
};

// Delete from MongoDB
export const deleteFromMongo = async (collection: string, id: string) => {
  try {
    await connectMongo();
    const Model = mongoose.model(collection);
    await Model.deleteOne({ _id: id });
    console.log(`✅ Deleted ${collection} ${id} from MongoDB`);
  } catch (error) {
    console.error(`❌ Failed to delete ${collection} ${id} from MongoDB:`, error);
  }
};

export default {
  syncUserToMongo,
  syncBookingToMongo,
  syncServiceToMongo,
  syncPaymentToMongo,
  fullSyncToMongo,
  deleteFromMongo
};
