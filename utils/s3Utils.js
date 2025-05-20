import {PutObjectCommand,GetObjectCommand, DeleteObjectCommand} from "@aws-sdk/client-s3"
import {getSignedUrl} from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from "uuid"
import s3Client from "./s3Client.js"

const uploadFilesToS3=async (files,folderPrefix="tasks/")=>{
    try {
        const uploadPromises=files.map(async (file)=>{
            const key=`${folderPrefix}${uuidv4()}_${file.originalname}`
            const params={
                Bucket:process.env.S3_BUCKET_NAME,
                Key:key,
                Body:file.buffer,
                ContentType:file.mimetype
            }
            await s3Client.send(new PutObjectCommand(params))
            return key
        })
        return await Promise.all(uploadPromises)
    } catch (error) {
        throw new Error("Error uploading files to S3: "+ error.message)
    }
}

const getPresignedUrls=async(fileKeys)=>{
    try {
        const urlPromises=fileKeys.map((key)=>{
            const params={
                Bucket:process.env.S3_BUCKET_NAME,
                Key:key
            }
            return getSignedUrl(s3Client,new GetObjectCommand(params),{
                expiresIn:3600
            })
        })
        return await Promise.all(urlPromises)
    } catch (error) {
        throw new Error("Error generating presigned URLs: "+ error.message)        
    }
}

const deleteFilesFromS3=async(fileKeys)=>{
    try {
        const deletePromises=fileKeys.map(async (key)=>{
            const params={
                Bucket:process.env.S3_BUCKET_NAME,
                Key:key
            }
            await s3Client.send(new DeleteObjectCommand(params))

        })
    } catch (error) {
        throw new Error("Error deleting files from S3: "+ error.message)
    }
}

export {uploadFilesToS3,getPresignedUrls,deleteFilesFromS3}