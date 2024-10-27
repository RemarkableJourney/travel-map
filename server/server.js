const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const travelRoutes = require('./routes/travel');
const config = require('./config');

const app = express();

app.use(cors());
app.use(express.json());

// 데이터베이스 연결
mongoose.connect(config.mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// 라우트
app.use('/api/auth', authRoutes);
app.use('/api/travel', travelRoutes);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
