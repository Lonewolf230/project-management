
import {Queue,Worker} from 'bullmq';
import dotenv from 'dotenv';
import { sendUserEmail } from '../utils/authUtils.js';
dotenv.config();
const redisConnection={
    host:process.env.REDIS_HOST,
    port:Number(process.env.REDIS_PORT),
    username:process.env.REDIS_USERNAME,
    password:process.env.REDIS_PASSWORD
}

export const emailQueue=new Queue('email-queue',{
    connection:redisConnection,
    defaultJobOptions:{
        removeOnComplete:true,
        removeOnFail:10,
        attempts:3,
        backoff:{
            type:'exponential',
            delay:2000
        },
    }
})

const worker= new Worker('email-queue',async(job)=>{
    const {toEmail,toName,role,password,username}=job.data;
    console.log(`Processing email for ${toName} (${toEmail}) with role ${role} and job id ${job.id}`);
    try{
        await sendUserEmail(toEmail,toName,role,password,username);
        await job.updateProgress(100);
        console.log(`Email sent successfully to ${toName} (${toEmail})`);
        return {status:'success',message:`Email sent to ${toName} (${toEmail})`};
    }
    catch(err){
        console.error(`Error sending email to ${toName} (${toEmail}):`, err);
        await job.updateProgress(0);
        throw new Error(`Failed to send email to ${toName} (${toEmail}): ${err.message}`);
    }    
},{connection:redisConnection})

worker.on('completed',(job)=>{
    console.log(`Job ${job.id} completed successfully`);
})

process.on('SIGTERM',async()=>{
    console.log('Received SIGTERM, gracefully shutting down email worker...');
    await worker.close();
    process.exit(0);
})

process.on('SIGINT',async()=>{
    console.log('Received SIGINT, gracefully shutting down email worker...');
    await worker.close();
    process.exit(0);
})