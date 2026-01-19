"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const prisma = require('../lib/database').default;
// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                profileImage: true,
                location: true,
                walletBalance: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get user by ID
exports.getUserById = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                profileImage: true,
                location: true,
                walletBalance: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Remove walletBalance for admin users
        const userResponse = { ...user };
        if (user.role === 'admin') {
            delete userResponse.walletBalance;
        }
        res.json(userResponse);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Update user profile (role-based field whitelist)
exports.updateUser = async (req, res) => {
    try {
        const body = req.body || {};
        const user = await prisma.user.findUnique({
            where: { id: req.params.id },
            include: {
                customer: true,
                serviceProvider: true
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Check if the user is updating their own profile or is an admin
        if (user.id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized' });
        }
        // Prepare update data
        const updateData = {};
        // Always-allowed common fields
        if (typeof body.firstName === 'string')
            updateData.firstName = body.firstName;
        if (typeof body.lastName === 'string')
            updateData.lastName = body.lastName;
        if (typeof body.phone === 'string')
            updateData.phone = body.phone;
        if (body.location)
            updateData.location = body.location;
        if (typeof body.profileImage === 'string')
            updateData.profileImage = body.profileImage;
        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: req.params.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                profileImage: true,
                location: true,
                walletBalance: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });
        // Remove walletBalance for admin users in response
        const userResponse = { ...updatedUser };
        if (updatedUser.role === 'admin') {
            delete userResponse.walletBalance;
        }
        // Update role-specific data
        if (user.role === 'customer' && body.customerDetails) {
            await prisma.customer.update({
                where: { userId: user.id },
                data: {
                    favouriteProviders: body.customerDetails.favouriteProviders || user.customer?.favouriteProviders,
                    totalBookings: typeof body.customerDetails.totalBookings === 'number' ? body.customerDetails.totalBookings : (user.customer?.totalBookings || 0),
                    ratingGivenAvg: typeof body.customerDetails.ratingGivenAvg === 'number' ? body.customerDetails.ratingGivenAvg : (user.customer?.ratingGivenAvg || 0)
                }
            });
        }
        else if (user.role === 'service_provider') {
            const providerUpdateData = {};
            if (Array.isArray(body.skills))
                providerUpdateData.skills = body.skills;
            if (typeof body.experienceYears === 'number')
                providerUpdateData.experienceYears = body.experienceYears;
            if (typeof body.isOnline === 'boolean')
                providerUpdateData.isOnline = body.isOnline;
            if (body.availability)
                providerUpdateData.availability = body.availability;
            if (body.serviceArea) {
                providerUpdateData.serviceAreaRadius = body.serviceArea.radiusInKm || user.serviceProvider?.serviceAreaRadius;
                providerUpdateData.serviceAreaCenter = body.serviceArea.baseLocation || user.serviceProvider?.serviceAreaCenter;
            }
            if (typeof body.isProfileComplete === 'boolean')
                providerUpdateData.isProfileComplete = body.isProfileComplete;
            if (Object.keys(providerUpdateData).length > 0) {
                await prisma.serviceProvider.update({
                    where: { userId: user.id },
                    data: providerUpdateData
                });
            }
        }
        res.json(userResponse);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Delete user (admin only)
exports.deleteUser = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await prisma.user.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'User removed' });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get all providers
exports.getAllProviders = async (req, res) => {
    try {
        const providers = await prisma.user.findMany({
            where: {
                role: 'service_provider',
                serviceProvider: {
                    isVerified: true
                }
            },
            include: {
                serviceProvider: true
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                profileImage: true,
                location: true,
                walletBalance: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json(providers);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Get providers by service category
exports.getProvidersByService = async (req, res) => {
    try {
        const { serviceCategory } = req.params;
        const providers = await prisma.user.findMany({
            where: {
                role: 'service_provider',
                serviceProvider: {
                    isVerified: true,
                    skills: {
                        has: serviceCategory
                    }
                }
            },
            include: {
                serviceProvider: true
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                isEmailVerified: true,
                isPhoneVerified: true,
                profileImage: true,
                location: true,
                walletBalance: true,
                status: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json(providers);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
// Admin: verify provider account
exports.verifyProvider = async (req, res) => {
    try {
        const { userId, token } = req.body;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                serviceProvider: true
            }
        });
        if (!user || user.role !== 'service_provider') {
            return res.status(404).json({ message: 'Provider not found' });
        }
        if (!user.serviceProvider?.verificationToken ||
            user.serviceProvider.verificationToken !== token ||
            (user.serviceProvider.verificationExpires && user.serviceProvider.verificationExpires < new Date())) {
            return res.status(400).json({ message: 'Invalid or expired verification token' });
        }
        await prisma.serviceProvider.update({
            where: { userId: user.id },
            data: {
                isVerified: true,
                verificationToken: null,
                verificationExpires: null
            }
        });
        res.json({ message: 'Provider verified', user: { id: user.id, isVerified: true } });
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};
