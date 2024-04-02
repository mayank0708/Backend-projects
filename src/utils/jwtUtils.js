import jwt from  'jsonwebtoken';
import { secretKey } from '../utils/jwtConfig.js';

function generateAccessToken(user) {
    const payload = {
        _id: user._id,
        email: user.email,
        username: user.username,
        fullName: user.fullName
    }
    return jwt.sign(payload, secretKey ,{ expiresIn:'1h'});
}

function generateRefreshToken(user) {
    const payload = {
        _id: user._id,
    }

    return jwt.sign(payload, secretKey ,{ expiresIn:'1h'});
}

export {
    generateAccessToken, 
    generateRefreshToken
}