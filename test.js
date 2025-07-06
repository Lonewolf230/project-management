// s3TestRunner.js
import dotenv from 'dotenv';
dotenv.config(); // load env vars from .env

import { getPresignedUrls } from './utils/s3Utils.js'; // adjust path
// e.g., './s3Service.js'

const run = async () => {
  try {
    // Replace with real S3 file keys (uploaded previously)
    const keys = [
            "686a94f373edc82588615086/68c82033-4680-45c2-b70f-367da5f43204_user.jpg",
            "686a94f373edc82588615086/3cf500b6-5cd7-4d3d-a47e-b555b24e87ed_diagram.png"
    ];

    const urls = await getPresignedUrls(keys);
    console.log('Generated URLs:\n', urls.join('\n'));
  } catch (error) {
    console.error('Error:', error);
  }
};

run();
