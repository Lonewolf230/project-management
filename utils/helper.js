import multer from "multer";

const MIME_TYPE_MAP = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 1024 * 1024 * 10,
        files: 5
    },
    fileFilter: (req, file, cb) => {
        const isValid = !!MIME_TYPE_MAP[file.mimetype];
        
        if (!isValid) {
            return cb(new Error('Invalid file type'), false);
        }
        
        cb(null, true);
    }
}).array('files');


const uploadMiddleware = (req, res, next) => {
  upload(req, res, function(err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            status: 'fail',
            message: 'File too large. Maximum size is 10MB.'
          });
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return res.status(400).json({
            status: 'fail',
            message: 'Unexpected field name for file upload.'
          });
        } 
        else {
          return res.status(400).json({
            status: 'fail',
            message: `File upload error: ${err.message}`
          });
        }
      } 
      else {
        return res.status(400).json({
          status: 'fail',
          message: err.message
        });
      }
    }
    next();
  });
};


const modifyTaskName=(taskFolderPrefix)=>{
    const taskName=taskFolderPrefix.split(" ")
    const taskNameWithUnderscore=taskName.join("_")
    return taskNameWithUnderscore
}

export { uploadMiddleware as upload,modifyTaskName };