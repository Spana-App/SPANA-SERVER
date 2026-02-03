"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../lib/database"));
// Create complaint (customers can report providers for harassment, etc.)
exports.createComplaint = async (req, res) => {
    try {
        const { bookingId, serviceId, type, severity, title, description, attachments, reportedAgainst } = req.body;
        if (!type || !title || !description) {
            return res.status(400).json({ message: 'Missing required fields: type, title, description' });
        }
        let complaintData = {
            reportedBy: req.user.id,
            reportedByRole: req.user.role === 'customer' ? 'customer' : 'service_provider',
            type,
            severity: severity || 'medium',
            title,
            description,
            attachments: attachments || null,
            status: 'open'
        };
        // If bookingId provided, verify user is involved
        if (bookingId) {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: {
                    customer: { include: { user: true } },
                    service: { include: { provider: { include: { user: true } } } }
                }
            });
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            const isCustomer = booking.customer.userId === req.user.id;
            const isProvider = booking.service.provider?.userId === req.user.id;
            if (!isCustomer && !isProvider && req.user.role !== 'admin') {
                return res.status(403).json({ message: 'Not authorized to create complaint for this booking' });
            }
            complaintData.bookingId = bookingId;
            complaintData.serviceId = serviceId || booking.serviceId;
            // If customer is reporting provider harassment
            if (isCustomer && type === 'harassment' && booking.service.provider) {
                complaintData.reportedAgainst = booking.service.provider.userId;
            }
        }
        else {
            // Complaint without booking (general complaint)
            complaintData.serviceId = serviceId || null;
            // If reportedAgainst is provided (customer reporting provider)
            if (reportedAgainst && req.user.role === 'customer') {
                const targetUser = await database_1.default.user.findUnique({
                    where: { id: reportedAgainst },
                    select: { id: true, role: true }
                });
                if (!targetUser || targetUser.role !== 'service_provider') {
                    return res.status(400).json({ message: 'Can only report service providers' });
                }
                complaintData.reportedAgainst = reportedAgainst;
            }
        }
        const complaint = await database_1.default.complaint.create({
            data: complaintData,
            include: {
                booking: {
                    include: {
                        service: true,
                        customer: { include: { user: true } }
                    }
                }
            }
        });
        // Notify admin via activity log
        try {
            await database_1.default.activity.create({
                data: {
                    userId: req.user.id,
                    actionType: 'complaint_created',
                    contentId: complaint.id,
                    contentModel: 'Complaint',
                    details: { bookingId, type, severity }
                }
            });
        }
        catch (_) { }
        res.status(201).json({
            message: 'Complaint created successfully',
            complaint
        });
    }
    catch (error) {
        console.error('Create complaint error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get user's complaints
exports.getMyComplaints = async (req, res) => {
    try {
        const complaints = await database_1.default.complaint.findMany({
            where: {
                reportedBy: req.user.id
            },
            include: {
                booking: {
                    include: {
                        service: true,
                        customer: { include: { user: true } }
                    }
                },
                service: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(complaints);
    }
    catch (error) {
        console.error('Get complaints error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
// Get complaint by ID
exports.getComplaintById = async (req, res) => {
    try {
        const { id } = req.params;
        const complaint = await database_1.default.complaint.findUnique({
            where: { id },
            include: {
                booking: {
                    include: {
                        service: {
                            include: {
                                provider: { include: { user: true } }
                            }
                        },
                        customer: { include: { user: true } }
                    }
                },
                service: true
            }
        });
        if (!complaint) {
            return res.status(404).json({ message: 'Complaint not found' });
        }
        // Check authorization (user must be involved in booking or admin)
        if (req.user.role !== 'admin') {
            if (complaint.reportedBy !== req.user.id) {
                // Check if user is involved in the booking
                const isCustomer = complaint.booking.customer.userId === req.user.id;
                const isProvider = complaint.booking.service.provider.userId === req.user.id;
                if (!isCustomer && !isProvider) {
                    return res.status(403).json({ message: 'Not authorized' });
                }
            }
        }
        res.json(complaint);
    }
    catch (error) {
        console.error('Get complaint error', error);
        res.status(500).json({ message: 'Server error' });
    }
};
