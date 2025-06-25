import express from "express";
import { checkCredentialExistence, comparePassword, hashPassword, verifyTokenMiddleware } from "../utils/authUtils.js";
import { catchAsync } from "../utils/helper.js";
import User from "../models/user.js";
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import client from "../utils/redisSetup.js";
dotenv.config();

const authRouter = express.Router();

authRouter.post("/login",catchAsync(async(req,res)=>{
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
    const isMatch=await comparePassword(password,user.password)
    if(!isMatch){
        return res.status(401).json({
            status:"fail",
            message:"Password does not match"
        })
    }
    const token=jwt.sign({userId:user.id},process.env.JWT_SECRET,{expiresIn:'1h'});
    if(!token){
        return res.status(500).json({
            status:"fail",
            message:"Error generating token"
        })
    }
    res.cookie('token',token,{
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', 
        maxAge: 300000,
        sameSite: 'Strict',
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
        printf("Token expiration time:", exp);
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