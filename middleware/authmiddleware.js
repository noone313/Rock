const jwt = require('jsonwebtoken');
const { User } = require('../models/tables'); // تأكد من تعديل المسار حسب ملف نماذجك


const verifyToken = (req, res, next) => {
    // التحقق من وجود الكوكيز
    const token = req.cookies.token; 

    if (!token) {
        return res.render('error-page', {
            message: "لم يتم توفير رمز الدخول (Token). يرجى تسجيل الدخول أولاً.",
            errorCode: "UNAUTHORIZED"
        });
    }

    try {
        // فك التوكن
        const decoded = jwt.verify(token, 'baqerali313'); // فك التوكن باستخدام السر
        req.user = decoded; // تخزين بيانات المستخدم في `req.user`
        next();  // الانتقال إلى الخطوة التالية
    } catch (error) {
        return res.render('error-page', {
            message: "لم يتم توفير رمز الدخول (Token). يرجى تسجيل الدخول أولاً.",
            errorCode: "UNAUTHORIZED"
        });
    }
};




const checkUserRole = (requiredRole) => {
    return async (req, res, next) => {
        try {
            const user = await User.findOne({ where: { userid: req.user.userid } });
            if (!user) {
                return res.render('error-page', {
                    message: "لم يتم العثور على المستخدم. يرجى تسجيل الدخول مرة أخرى.",
                    errorCode: "UNAUTHORIZED"
                });
            }
            if (user.usertype !== requiredRole) {
                return res.render('error-page', {
                    message: "ليس لديك الصلاحية للوصول إلى هذه الصفحة.",
                    errorCode: "UNAUTHORIZED"
                });
            }
            req.user.subid = user.subid; // تأكد من أن subid موجود في req.user
            next();
        } catch (error) {
            console.error(error);
            return res.render('error-page', {
                message: "حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.",
                errorCode: "UNAUTHORIZED"
            });
        }
    };
};

module.exports = {
    verifyToken,
    checkUserRole
};
