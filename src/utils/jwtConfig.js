import crypto  from 'crypto';

// generate random secret key
const secretKey = crypto.randomBytes(32).toString('hex');


export {secretKey}