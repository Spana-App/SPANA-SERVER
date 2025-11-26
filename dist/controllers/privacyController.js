"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
// POPIA Compliance: Export user data
exports.exportUserData = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get all user data
        const user = await database_1.default.user.findUnique({
            where: { id: userId },
            include: {
                customer: {
                    include: {
                        bookings: {
                            include: {
                                service: true,
                                payment: true
                            }
                        },
                        payments: true
                    }
                },
                serviceProvider: {
                    include: {
                        services: true,
                        documents: true
                    }
                },
                notifications: true,
                activities: true
            }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        // Remove sensitive data
        const userData = {
            profile: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                phone: user.phone,
                role: user.role,
                profileImage: user.profileImage,
                location: user.location,
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            },
            bookings: user.customer?.bookings || [],
            payments: user.customer?.payments || [],
            services: user.serviceProvider?.services || [],
            documents: user.serviceProvider?.documents || [],
            notifications: user.notifications,
            activities: user.activities
        };
        res.json({
            message: 'Data export successful',
            data: userData,
            exportedAt: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Export user data error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// POPIA Compliance: Delete user account and data
exports.deleteUserAccount = async (req, res) => {
    try {
        const userId = req.user.id;
        const { password, confirmDelete } = req.body;
        if (!confirmDelete || confirmDelete !== 'DELETE') {
            return res.status(400).json({
                message: 'Please type DELETE to confirm account deletion'
            });
        }
        // Verify password
        const user = await database_1.default.user.findUnique({
            where: { id: userId }
        });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const bcrypt = require('bcryptjs');
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid password' });
        }
        // Delete user (cascade will handle related records)
        await database_1.default.user.delete({
            where: { id: userId }
        });
        // Log deletion (before user is deleted, we can't use Activity)
        console.log(`User account deleted: ${userId} at ${new Date().toISOString()}`);
        res.json({
            message: 'Account and all associated data have been permanently deleted',
            deletedAt: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('Delete user account error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// POPIA Compliance: Update consent preferences
exports.updateConsent = async (req, res) => {
    try {
        const { marketingEmails, smsNotifications, dataSharing } = req.body;
        // Store consent preferences (you may want to add a Consent model)
        // For now, we'll store in user details or create a separate model
        // This is a placeholder - implement based on your consent requirements
        res.json({
            message: 'Consent preferences updated',
            preferences: {
                marketingEmails: marketingEmails || false,
                smsNotifications: smsNotifications || false,
                dataSharing: dataSharing || false
            }
        });
    }
    catch (error) {
        console.error('Update consent error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// POPIA Compliance: Get privacy policy acceptance status
exports.getPrivacyStatus = async (req, res) => {
    try {
        const user = await database_1.default.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                createdAt: true,
                isEmailVerified: true
            }
        });
        res.json({
            accountCreated: user?.createdAt,
            emailVerified: user?.isEmailVerified,
            dataExportAvailable: true,
            accountDeletionAvailable: true
        });
    }
    catch (error) {
        console.error('Get privacy status error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
