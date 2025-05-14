import dotenv from 'dotenv'
dotenv.config()

let uri

if(process.env.NODE_ENV === 'development') {
  uri = process.env.MONGODB_URI
}
else if(process.env.NODE_ENV === 'production') {
  uri = process.env.PROD_MONGODB_URI
}
else if(process.env.NODE_ENV === 'test') {
  uri = process.env.TEST_MONGODB_URI
}
else{
    throw new Error('NODE_ENV not set')
}

const port=process.env.PORT || 3000;

export {uri,port}