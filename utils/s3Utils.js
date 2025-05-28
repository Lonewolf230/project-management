import {PutObjectCommand,GetObjectCommand, DeleteObjectCommand} from "@aws-sdk/client-s3"
import {getSignedUrl} from "@aws-sdk/s3-request-presigner"
import { v4 as uuidv4 } from "uuid"
import s3Client from "./s3Client.js"
import { modifyTaskName } from "./helper.js"
import { errors } from "./appError.js"

const uploadFilesToS3=async (files,folderPrefix="tasks/")=>{
    try {
        if(!files || files.length===0){
            throw errors.badRequest("No files provided for upload")
        }
        const uploadPromises=files.map(async (file)=>{
            const modifiedTaskName=modifyTaskName(folderPrefix)
            const key=`${modifiedTaskName}${uuidv4()}_${file.originalname}`
            const params={
                Bucket:process.env.SPACE_NAME,
                Key:key,
                Body:file.buffer,
                ContentType:file.mimetype
            }
            await s3Client.send(new PutObjectCommand(params))
            return key
        })
        return await Promise.all(uploadPromises)
    } catch (error) {
        if(error.isOperational){
            throw error
        }
        throw errors.badRequest("Error uploading files to S3: "+ error.message)
    }
}

const getPresignedUrls=async(fileKeys)=>{
    try {
        const urlPromises=fileKeys.map((key)=>{
            const params={
                Bucket:process.env.SPACE_NAME,
                Key:key
            }
            return getSignedUrl(s3Client,new GetObjectCommand(params),{
                expiresIn:3600
            })
        })
        return await Promise.all(urlPromises)
    } catch (error) {
        throw errors.badRequest("Error generating presigned URLs: "+ error.message)
    }
}

const deleteFilesFromS3=async(fileKeys)=>{
    try {
        const deletePromises=fileKeys.map(async (key)=>{
            const params={
                Bucket:process.env.SPACE_NAME,
                Key:key
            }
            await s3Client.send(new DeleteObjectCommand(params))

        })
        await Promise.all(deletePromises)
    } catch (error) {
        throw errors.badRequest("Error deleting files from S3: "+ error.message);
        
    }
}

export {uploadFilesToS3,getPresignedUrls,deleteFilesFromS3}