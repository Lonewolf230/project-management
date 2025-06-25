import bcrypt from 'bcrypt';
import { errors } from './appError.js';
import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import client from './redisSetup.js';

export const randomPasswordGenerator=()=>{
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        password += characters[randomIndex];
    }
    console.log(`Generated random password: ${password}`);
    return password;
}

export const hashPassword=async(password)=>{
    if(!password) throw errors.badRequest('Password is required for hashing');
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    console.log(`Hashed password: ${hashedPassword}`);
    return hashedPassword;
}

export const checkCredentialExistence=(email,password)=>{
    if(!email || !password) throw errors.badRequest('Email and password are required for checking credentials');
}

export const comparePassword=async(password,hashedPassword)=>{
    if(!password || !hashedPassword) throw errors.badRequest('Password and hashed password are required for comparison');
    const isMatch = await bcrypt.compare(password, hashedPassword);
    if (!isMatch) {
        throw errors.unauthorized('Invalid email or password');
    }
    return isMatch;
}

export const verifyTokenMiddleware = async(req, res, next) => {
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({ error: 'Authentication token missing' });
    }
    try {
        const isBlackListed= await client.get(`bl${token}`)
        console.log(`Token blacklisted status: ${isBlackListed}`);
        if(isBlackListed){
            return res.status(401).json({ error: 'Token is blacklisted' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
};

const transporter=nodemailer.createTransport({
    service:'gmail',
    auth:{
        user:process.env.EMAIL_ID,
        pass:process.env.PASSWORD
    }
})

export const sendUserEmail=async(toEmail,toName,role='user',password,username)=>{
    if(!toEmail || !toName || !role) throw errors.badRequest('Email, name and role are required to send email');
    
    const mailOptions = {
        from: process.env.EMAIL_ID,
        to: toEmail,
        subject: 'Welcome to Project Management System',
        text: `Hello ${toName},\n\nWelcome to the Project Management System! You have been assigned the role of ${role}.
        Here are your default credentials:\n\nUsername: ${username}\nPassword: ${password}\n\nPlease log in and change your password as soon as possible.\n\nIf you have any questions or need assistance, feel free to reach out to the support team.\n\nBest regards,\nProject Management Team`
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${toEmail}`);
    } catch (error) {
        console.error(`Error sending email: ${error.message}`);
        throw new Error('Failed to send email',statusCode=500);
    }
}



