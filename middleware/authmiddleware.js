const jwt = require('jsonwebtoken');
const { User } = require('../models/tables'); // تأكد من تعديل المسار حسب ملف نماذجك


const verifyToken = (req, res, next) => {
    // التحقق من وجود الكوكيز
    const token = req.cookies.token; 

    if (!token) {
        return res.status(403).json({ message: 'Access denied. No token provided.' });
    }

    try {
        // فك التوكن
        const decoded = jwt.verify(token, 'baqerali313'); // فك التوكن باستخدام السر
        req.user = decoded; // تخزين بيانات المستخدم في `req.user`
        next();  // الانتقال إلى الخطوة التالية
    } catch (error) {
        return res.status(400).json({ message: 'Invalid token.' });
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
