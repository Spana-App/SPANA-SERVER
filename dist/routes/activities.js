"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
const auth = require('../middleware/auth');
const prisma = require('../lib/database').default;
// Get my activities (most recent first)
router.get('/', auth, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
        const activities = await prisma.activity.findMany({
            where: { userId: req.user.id }
        });
        res.json(activities);
    }
    catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
module.exports = router;
