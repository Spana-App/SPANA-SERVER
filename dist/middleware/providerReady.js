"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const providerReady = (req, res, next) => {
    try {
        const user = req.user;
        if (!user)
            return res.status(401).json({ message: 'Unauthorized' });
        if (user.role !== 'service_provider')
            return res.status(403).json({ message: 'Only service providers allowed' });
        if (!user.serviceProvider?.isProfileComplete)
            return res.status(403).json({ message: 'Provider profile incomplete. Complete profile to proceed.' });
        next();
    }
    catch (e) {
        return res.status(500).json({ message: 'Server error' });
    }
};
module.exports = providerReady;
