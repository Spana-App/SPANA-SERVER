// Optional authentication middleware
// Sets req.user if token is valid, but doesn't fail if token is missing
const jwt = require('jsonwebtoken');
const prisma = require('../lib/database').default;

const optionalAuth = async (req: any, res: any, next: any) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // No token provided - continue without setting req.user
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: {
          customer: true,
          serviceProvider: true
        }
      });
      
      if (user) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (tokenError) {
      // Invalid token - continue without setting req.user
      req.user = null;
    }
    
    next();
  } catch (error) {
    // Any error - continue without setting req.user
    req.user = null;
    next();
  }
};

module.exports = optionalAuth;
export {};

