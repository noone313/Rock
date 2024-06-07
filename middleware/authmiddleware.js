const jwt = require('jsonwebtoken');
const { User } = require('../models/tables'); // تأكد من تعديل المسار حسب ملف نماذجك

const verifyToken = (req, res, next) => {
    const token = req.cookies.token || req.headers['authorization'];
    if (!token) {
        return res.status(401).send('Token not provided');
    }
    try {
        const decoded = jwt.verify(token, 'baqerali313'); // تأكد من استخدام المفتاح السري الصحيح
        req.user = decoded;
        next();
    } catch (err) {
        console.error('Error decoding JWT:', err);
        return res.status(400).json({ error: 'Invalid token' });
    }
};



const checkUserRole = (requiredRole) => {
    return async (req, res, next) => {
        try {
            const user = await User.findOne({ where: { userid: req.user.userid } });
            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }
            if (user.usertype !== requiredRole) {
                return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
            }
            req.user.subid = user.subid; // تأكد من أن subid موجود في req.user
            next();
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'An error occurred while checking user role' });
        }
    };
};

module.exports = {
    verifyToken,
    checkUserRole
};
