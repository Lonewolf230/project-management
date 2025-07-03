import express from "express";
import { checkCredentialExistence, comparePassword, hashPassword, verifyTokenMiddleware } from "../utils/authUtils.js";
import { catchAsync } from "../utils/helper.js";
import User from "../models/user.js";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import client from "../utils/redisSetup.js";
import { validateAdmin, validateSuperAdmin } from "../utils/validationUtils.js";
dotenv.config();
import rateLimit from "express-rate-limit";

const isTest=process.env.NODE_ENV==='test';

const loginLimiter=rateLimit({
    windowMs:5*60*1000,
    max:isTest ? 100 : 15,
    message:"Too many login attempts from this IP, please try again after 15 minutes",
})

const authRouter = express.Router();

authRouter.post("/login",loginLimiter,catchAsync(async(req,res)=>{
    const {email,password}=req.body;
    checkCredentialExistence(email,password);

    const user=await User.findOne({email}).select('password');
    console.log("User found:", user);
    if(!user){

        return res.status(401).json({
            status:"fail",
            message:"User with given credentials does not exist"
        })
    }
    await comparePassword(password,user.password)
    const token=jwt.sign({userId:user.id},process.env.JWT_SECRET,{expiresIn:'1h'});
    if(!token){
        return res.status(500).json({
            status:"fail",
            message:"Error generating token"
        })
    }
    const isProd = process.env.NODE_ENV === 'production';

    res.cookie('token',token,{
        httpOnly: true,
        secure: isProd, 
        maxAge: 300000,
        sameSite: isProd ? 'none' : 'lax',
    })
    res.status(200).json({
        status:"success",
        message:"User logged in successfully",
        user:{
            id:user.id,
        }
    })

}))

authRouter.patch("/change-password",verifyTokenMiddleware,catchAsync(async(req,res)=>{
    const userId=req.user;
    const {currentPassword,newPassword}=req.body;
    if(!currentPassword || !newPassword){
        console.log("Current or new password not provided");
        
        return res.status(400).json({
            status:"fail",
            message:"Please provide current and new password"
        })
    }
    
    const user=await User.findById(userId).select('password');
    await comparePassword(currentPassword,user.password)
    const hashedNewPassword=await hashPassword(newPassword);
    user.password=hashedNewPassword
    await user.save();
    res.status(200).json({
        status:"success",
        message:"Password changed successfully"
    })
}))

authRouter.patch("/change-role",verifyTokenMiddleware,catchAsync(async(req,res)=>{
    const userId=req.user;
    const {newRole,affectedUserId}=req.body;
    if(!newRole){
        return res.status(400).json({
            status:"fail",
            message:"Please provide a new role"
        })
    }
    if(newRole==='super-admin' || newRole==='admin') await validateSuperAdmin(userId);
    else await validateAdmin(userId);

    const user=await User.findById(affectedUserId);

    if(user.id.toString()===userId.toString()){
        return res.status(400).json({
            status:"fail",
            message:"You cannot change your own role"
        });
    }

    user.role=newRole;
    await user.save();
    res.status(200).json({
        status:"success",
        message:"User role changed successfully"
    })
}))

authRouter.post("/logout",async(req,res)=>{
    const token = req.cookies?.token;
    if (!token) {
        return res.status(401).json({
            status: "fail",
            message: "User is not logged in"
        });
    }
    try {
        const decoded=jwt.verify(token,process.env.JWT_SECRET);
        const exp=decoded.exp;
        console.log("Token expiration time:", exp);
        const now=Math.floor(Date.now() / 1000);
        const ttl=exp-now

        if(ttl>0) {
            console.log(`Token TTL: ${ttl} seconds`);
            console.log('Writing to redis');
            
            await client.setEx(`bl:${token}`,ttl,'blacklisted')
            console.log(`Token blacklisted for ${ttl} seconds`);
            
        }    
        res.clearCookie('token');
        res.status(200).json({
            status:"success",
            message:"User logged out successfully"
        })
    } catch (error) {
        res.status(401).json({
            status: "fail",
            message: "Error logging out user",
            error: error.message
        })
    }
})



export default authRouter;