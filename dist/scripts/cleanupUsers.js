"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Usage: node scripts/cleanupUsers.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const users = await User.find();
    let cleaned = 0;
    for (const user of users) {
        let changed = false;
        if (user.role === 'customer') {
            const toDelete = ['skills', 'rating', 'totalReviews', 'documents', 'availability', 'serviceArea', 'experienceYears', 'isOnline'];
            for (const k of toDelete)
                if (user[k] !== undefined) {
                    user.set(k, undefined);
                    changed = true;
                }
            // ensure customerDetails exists
            if (!user.customerDetails) {
                user.customerDetails = { favouriteProviders: [], totalBookings: 0, ratingGivenAvg: 0 };
                changed = true;
            }
        }
        else if (user.role === 'service provider') {
            // remove customer-only fields
            if (user.customerDetails !== undefined) {
                user.set('customerDetails', undefined);
                changed = true;
            }
        }
        else {
            // admin/system: remove provider/customer specific fields
            const toDelete = ['skills', 'rating', 'totalReviews', 'documents', 'availability', 'serviceArea', 'experienceYears', 'isOnline', 'customerDetails'];
            for (const k of toDelete)
                if (user[k] !== undefined) {
                    user.set(k, undefined);
                    changed = true;
                }
        }
        if (changed) {
            await user.save();
            cleaned++;
        }
    }
    console.log(`Cleanup complete. Updated ${cleaned} users.`);
    await mongoose.connection.close();
}
run().catch(err => { console.error(err); process.exit(1); });
