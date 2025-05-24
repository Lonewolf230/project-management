import multer from "multer";
import { errors } from "./appError.js";

const MIME_TYPE_MAP = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 10,
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    const isValid = !!MIME_TYPE_MAP[file.mimetype];

    if (!isValid) {
      return cb(new Error("Invalid file type"), false);
    }

    cb(null, true);
  },
}).array("files");

const uploadMiddleware = (req, res, next) => {
  upload(req, res, function (err) {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            status: "fail",
            message: "File too large. Maximum size is 10MB.",
          });
        } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            status: "fail",
            message: "Unexpected field name for file upload.",
          });
        } else {
          return res.status(400).json({
            status: "fail",
            message: `File upload error: ${err.message}`,
          });
        }
      } else {
        return res.status(400).json({
          status: "fail",
          message: err.message,
        });
      }
    }
    next();
  });
};

const modifyTaskName = (taskFolderPrefix) => {
  const taskName = taskFolderPrefix.split(" ");
  const taskNameWithUnderscore = taskName.join("_");
  return taskNameWithUnderscore;
};

export const globalErrorHandler = (err, req, res, next) => {
  console.error(err);
  if (res.headersSent) {
    return next(err);
  }

  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  const duplicateError = err.code === 11000 || err.cause?.code === 11000;

  if (duplicateError) {
    const mongoError = err.cause || err;

    let field = "field";
    let value = "";

    if (mongoError.keyValue) {
      field = Object.keys(mongoError.keyValue)[0];
      value = mongoError.keyValue[field];
    } else if (mongoError.keyPattern) {
      field = Object.keys(mongoError.keyPattern)[0];
    } else if (mongoError.errmsg || mongoError.message) {
      const errorMsg = mongoError.errmsg || mongoError.message;
      const match =
        errorMsg.match(/index: (\w+)_/) || errorMsg.match(/dup key: { (\w+):/);
      if (match) {
        field = match[1];
      }
    }

    const message = `${field} '${value}' already exists. Please use a different value.`;
    return res.status(400).json({
      status: "fail",
      message: message,
    });
  }

  if (err.name === "CastError") {
    let message = "Invalid ID format";

    if (err.value === "" && err.path) {
      message = `${err.path} cannot be empty`;
    } else if (err.path) {
      message = `Invalid ${err.path} format`;
    }

    return res.status(400).json({
      status: "fail",
      message,
    });
  }

  if (err.name === "ValidationError") {
    const dateError = Object.values(err.errors).find(
      (e) =>
        e.message &&
        e.message.includes("End date must be greater than start date")
    );

    if (dateError) {
      return res.status(400).json({
        status: "fail",
        message: "End date must be greater than start date",
      });
    }

    const message = Object.values(err.errors)
      .map((val) => val.message)
      .join(". ");
    return res.status(400).json({
      status: "fail",
      message,
    });
  }

  res.status(500).json({
    status: "error",
    message: "Something went wrong!",
  });
};

export const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

export const cleanEmptyStrings = (obj) => {
  const cleanedObj = { ...obj };
  Object.keys(cleanedObj).forEach((key) => {
    if (cleanedObj[key] === "" || cleanedObj[key] === null) {
      delete cleanedObj[key];
    }
  });
  return cleanedObj;
};

export const validateDateRange = (startDate, endDate) => {
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      throw errors.badRequest("End date must be greater than start date");
    }
  }
};

export { uploadMiddleware as upload, modifyTaskName };
