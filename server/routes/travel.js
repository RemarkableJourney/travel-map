const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Travel = require('../models/Travel');

// 여행 데이터 가져오기
router.get('/', auth, async (req, res) => {
    try {
        const travel = await Travel.findOne({ user: req.user.id });
        if (!travel) {
            return res.status(404).json({ msg: '여행 데이터가 없습니다.' });
        }
        res.json(travel);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
    }
});

// 여행 데이터 저장/업데이트
router.post('/', auth, async (req, res) => {
    const { locations } = req.body;

    try {
        let travel = await Travel.findOne({ user: req.user.id });
        if (travel) {
            // 기존 데이터 업데이트
            travel.locations = locations;
        } else {
            // 새 데이터 생성
            travel = new Travel({
                user: req.user.id,
                locations
            });
        }
        await travel.save();
        res.json(travel);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('서버 오류');
    }
});

module.exports = router;