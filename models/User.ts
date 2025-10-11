const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  role: { type: String, enum: ['customer', 'service provider', 'System_admin'], default: 'customer' },
  // Provider flags
  isVerified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isIdentityVerified: { type: Boolean, default: false },
  availability: {
    days: [{ type: String }],
    hours: { start: { type: String }, end: { type: String } }
  },
  serviceArea: {
    radiusInKm: { type: Number, default: 0 },
    baseLocation: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] }
    }
  },
  experienceYears: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: false },
  documents: [{ type: { type: String }, url: String, verified: { type: Boolean, default: false } }],
  verification: { token: { type: String }, expiresAt: { type: Date } },
  skills: [{ type: String }],
  profileImage: { type: String, default: '' },
  rating: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
    address: String
  },
  paymentMethods: [{ type: { type: String, enum: ['card', 'wallet', 'mobile_money'] }, details: mongoose.Schema.Types.Mixed }],
  walletBalance: { type: Number, default: 0 },
  customerDetails: {
    favouriteProviders: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    totalBookings: { type: Number, default: 0 },
    ratingGivenAvg: { type: Number, default: 0 }
  },
  dateOfBirth: { type: Date },
  status: { type: String, enum: ['active', 'inactive', 'banned'], default: 'active' },
  lastLoginAt: { type: Date },
  isProfileComplete: { type: Boolean, default: false }
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

userSchema.pre('save', async function(next: any) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword: string) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.pre('save', function(next: any) {
  const user: any = this;
  user.isProfileComplete = false;
  if (user.role === 'service provider') {
    const hasProfileImage = Boolean(user.profileImage);
    const hasSkills = Array.isArray(user.skills) && user.skills.length > 0;
    const hasExperience = typeof user.experienceYears === 'number' && user.experienceYears > 0;
    const hasAvailability = user.availability && Array.isArray(user.availability.days) && user.availability.days.length > 0 && user.availability.hours && user.availability.hours.start && user.availability.hours.end;
    const hasServiceArea = user.serviceArea && user.serviceArea.radiusInKm > 0 && user.serviceArea.baseLocation && Array.isArray(user.serviceArea.baseLocation.coordinates) && user.serviceArea.baseLocation.coordinates.some((c: number) => c !== 0);
    const verifiedDocExists = Array.isArray(user.documents) && user.documents.some((d: any) => d.verified);
    const emailOk = !!user.isEmailVerified;
    const phoneOk = !!user.isPhoneVerified;
    const idOk = !!user.isIdentityVerified;
    user.isProfileComplete = hasProfileImage && hasSkills && hasExperience && hasAvailability && hasServiceArea && verifiedDocExists && emailOk && phoneOk && idOk;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
export {};