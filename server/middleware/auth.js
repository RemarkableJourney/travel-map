const jwt = require('jsonwebtoken');
const config = require('../config');

module.exports = function (req, res, next) {
    // 토큰 가져오기
    const token = req.header('x-auth-token');

    // 토큰이 없으면
    if (!token) {
        return res.status(401).json({ msg: '인증 토큰이 없습니다. 접근이 거부되었습니다.' });
    }

    try {
        // 토큰 검증
        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded.user;
        next();
    } catch (err) {
        res.status(401).json({ msg: '토큰이 유효하지 않습니다.' });
    }
};