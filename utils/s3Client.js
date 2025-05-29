import {S3Client} from '@aws-sdk/client-s3'
import dotenv from 'dotenv'
dotenv.config()

const s3Client=new S3Client({
    region:process.env.REGION,
    endpoint:`https://${process.env.SPACE_NAME}.digitaloceanspaces.com`,
    credentials:{
        accessKeyId:process.env.ACCESS_KEY,
        secretAccessKey:process.env.SECRET_ACCESS_KEY
    },
    forcePathStyle:false
})

export default s3Client