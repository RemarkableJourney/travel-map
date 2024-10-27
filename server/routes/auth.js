const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

// 회원가입
router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        // 이메일 중복 체크
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: '이미 등록된 이메일입니다.' });
        }

        // 사용자 이름 중복 체크
        user = await User.findOne({ username });
        if (user) {
            return res.status(400).json({ msg: '이미 사용 중인 사용자 이름입니다.' });
        }

        // 새 사용자 생성
        user = new User({
            username,
            email,
            password
        });

        // 비밀번호 해싱
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        // 사용자 저장
        await user.save();

        // JWT 토큰 생성
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            config.jwtSecret,
            { expiresIn: 3600 }, // 1시간 후 만료
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
    }
});

// 로그인
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 사용자 확인
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: '유효하지 않은 인증 정보입니다.' });
        }

        // 비밀번호 확인
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: '유효하지 않은 인증 정보입니다.' });
        }

        // JWT 토큰 생성
        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            config.jwtSecret,
            { expiresIn: 3600 }, // 1시간 후 만료
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
    }
});

module.exports = router;
