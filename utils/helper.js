import multer from "multer";
import { errors } from "./appError.js";
import { validateObjectId } from "./validationUtils.js";

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

export const processFileKeys=(fileKeys)=>{
  if(!fileKeys || fileKeys.length === 0) {
    return [];
  }
  if(typeof fileKeys === 'string') {
    return [fileKeys];
  }
  if(Array.isArray(fileKeys)) {
    return fileKeys;
  }
  return [];
}

export const processRequiredSkills=(skills)=>{
  if(!skills || skills.length === 0) {
    return [];
  }
  if(typeof skills === 'string') {
    return [skills];
  }
  if(Array.isArray(skills)) {
    return skills;
  }
  return [];
}

export const processTags=(tags)=>{
  if(!tags || tags.length === 0) {
    return [];
  }
  if(typeof tags === 'string') {
    return [tags];
  }
  if(Array.isArray(tags)) {
    return tags;
  }
  return [];
}

export const validateAssignees=async (assignees,project)=>{
  if(typeof project!="object" ){
    throw errors.badRequest("Invalid project object");
  }
  if(!assignees || assignees.length === 0) {
    return [];
  }
  const assigneeIds= Array.isArray(assignees) ? assignees : [assignees];
  assigneeIds.forEach(id=>validateObjectId(id, "Assignee ID"));
  const invalidAssignees=assigneeIds.filter(
    id=>!project.teamMembers.some(member=>member.toString()=== id.toString())
  )
  if(invalidAssignees.length > 0) {
    throw errors.badRequest(
      `These assignees dont belong to this project : ${invalidAssignees.join(", ")}. Please add them to the project first.`
    );
  }
  return assigneeIds
}

export const validateTaskDates= (startDate, dueDate, projectStartDate, projectEndDate) => {
  if (startDate < projectStartDate) {
    throw errors.badRequest(
      `Task start date must be on or after project start date (${projectStartDate.toISOString()})`
    );
  }

  if (dueDate > projectEndDate) {
    throw errors.badRequest(
      `Task due date must be on or before project end date (${projectEndDate.toISOString()})`
    );
  }

  if (dueDate < startDate) {
    throw errors.badRequest("Task due date must be after start date");
  }
};

export const parseSelectedUserIds=(selectedUsersArray,selectedUsersString)=>{
    if (selectedUsersString) {
      try {
        selectedUsersArray = selectedUsersString.split(',').filter(id => id.trim());
        return selectedUsersArray
      } catch (error) {
        selectedUsers = [];
      }
    }
    return [];
}

export const validateSkills=(skillsArray,skills,res)=>{
    if (skills) {
      try {
        skillsArray = JSON.parse(skills);
        if (!Array.isArray(skillsArray)) {
          throw errors.badRequest("Skills must be a JSON array");
        }
      } catch (error) {

        throw errors.badRequest("Invalid skills format. Must be a JSON array.");
      }

      for (let i = 0; i < skillsArray.length; i++) {
        const skill = skillsArray[i];
        if (!skill.skillId || !skill.minLevel) {
          throw errors.badRequest(`Skill ID and minimum level are required for skill at position ${i + 1}`);
        }
        validateObjectId(skill.skillId, "Skill ID");
        const level = parseInt(skill.minLevel);
        if (isNaN(level) || level < 1 || level > 5) {
          throw errors.badRequest(`Skill level must be between 1 and 5 for skill at position ${i + 1}`);
        }
      }
      return skillsArray;
    }
    return [];
}

export const validateSearchTaskDates=(taskStartDate,taskEndDate,requiredHours,res)=>{
        if (!taskStartDate || !taskEndDate) {

        throw errors.badRequest("Task start date and end date are required when required hours is provided");
      }

      const hours = parseFloat(requiredHours);
      if (isNaN(hours) || hours <= 0) {
        throw errors.badRequest("Required hours must be a positive number");
      }

      const startDate = new Date(taskStartDate);
      const endDate = new Date(taskEndDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw errors.badRequest("Invalid start or end date format. Use YYYY-MM-DD");
      }
      if (startDate > endDate) {
        throw errors.badRequest("Start date must be before end date");
      }
}

export const validateSkillsArrayAndLength=(skills,lenSkills)=>{
    if (!skills || !Array.isArray(skills)) throw errors.badRequest("Skills array is required");

  if (skills.length !== lenSkills) throw errors.badRequest(`Exactly ${lenSkills} skills must be provided`);
}

export const validateUserCreationSkills=(skills)=>{
    for (let i = 0; i < skills.length; i++) {
      const skill = skills[i];

      if (!skill.skillId || skill.skillId.trim() === "") {
        throw errors.badRequest(`Skill ID is required for skill at position ${i + 1}`);
      }

      if (!skill.level || skill.level === "") {
        throw errors.badRequest(`Skill level is required for skill at position ${i + 1}`);
      }

      const levelNum = parseInt(skill.level);
      if (isNaN(levelNum) || levelNum < 1 || levelNum > 5) {
        throw errors.badRequest(`Skill level must be between 1 and 5 for skill at position ${i + 1}`);
      }
  }
}

export const buildSearchQuery=(teamMembers,query,skillsArray)=>{
  console.log(`Skills arrya in utility function: ${skillsArray.length}`);
    const searchQuery = {
      _id: { $in: teamMembers},
    };

    if (query.trim()) {
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchTerm = escapeRegex(query.trim());
      searchQuery.$or = [
        { name: { $regex: `^${searchTerm}`, $options: "i" } },
        { email: { $regex: `^${escapeRegex(query)}`, $options: "i" } },
      ];
    }
    if (skillsArray.length > 0) {
      const skillConditions = skillsArray.map((skill) => ({
        skills: {
          $elemMatch: {
            skillId: skill.skillId,
            level: { $gte: parseInt(skill.minLevel) },
          },
        },
      }));

      if (searchQuery.$or) {
        searchQuery.$and = [{ $or: searchQuery.$or }, ...skillConditions];
        delete searchQuery.$or;
      } else {
        searchQuery.$and = skillConditions;
      }
    }

    return searchQuery
}

export { uploadMiddleware as upload, modifyTaskName };
