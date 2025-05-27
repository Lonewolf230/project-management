import Skill from "../models/skill.js";
import User from "../models/user.js";
import express from "express";
import {
  validateAdminExists,
  validateAdminOrProjectManager,
  validateObjectId,
} from "../utils/validationUtils.js";
import { errors } from "../utils/appError.js";
const userRouter = express.Router();

userRouter.post("/create", async (req, res) => {
  const { name, email, role, skills } = req.body;
  if (!skills || !Array.isArray(skills)) {
    return res.status(400).json({
      status: "fail",
      message: "Skills array is required",
    });
  }

  if (skills.length !== 5) {
    return res.status(400).json({
      status: "fail",
      message: "Exactly 5 skills must be provided",
    });
  }
  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];

    if (!skill.skillId || skill.skillId.trim() === "") {
      return res.status(400).json({
        status: "fail",
        message: `Skill ID is required for skill at position ${i + 1}`,
      });
    }

    if (!skill.level || skill.level === "") {
      return res.status(400).json({
        status: "fail",
        message: `Skill level is required for skill at position ${i + 1}`,
      });
    }

    const levelNum = parseInt(skill.level);
    if (isNaN(levelNum) || levelNum < 1 || levelNum > 5) {
      return res.status(400).json({
        status: "fail",
        message: `Skill level must be between 1 and 5 for skill at position ${
          i + 1
        }`,
      });
    }
  }

  const skillIds = skills.map((s) => s.skillId);
  const existingSkills = await Skill.find({ _id: { $in: skillIds } });

  if (existingSkills.length !== 5) {
    return res.status(400).json({
      status: "fail",
      message: "One or more skill IDs are invalid",
    });
  }

  const user = await User.create({
    name,
    email,
    role,
    skills: skills.map((skill) => ({
      skillId: skill.skillId,
      level: parseInt(skill.level),
    })),
  });
  res.status(201).json({
    status: "success",
    user,
  });
});

userRouter.get("/allUsers", async (req, res) => {
  const { adminId } = req.query;
  try {
    if (!adminId) {
      return res.status(400).json({
        status: "fail",
        message: "Admin ID is required",
      });
    }
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        status: "fail",
        message: "Admin not found",
      });
    }
    if (admin.role !== "admin") {
      return res.status(403).json({
        status: "fail",
        message: "Only admins can view all users",
      });
    }
    const users = await User.find().select("id name email role projects");
    if (users.length === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No users found",
      });
    }
    res.status(200).json({
      status: "success",
      data: {
        users,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

userRouter.get("/searchUsers", async (req, res) => {
  const { adminId, query = "", limit = 10, role = "" } = req.query;
  console.log(query);

  try {
    await validateAdminExists(adminId);
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const baseQuery = {
      $or: [
        { name: { $regex: `^${escapeRegex(query)}`, $options: "i" } },
        { email: { $regex: `^${escapeRegex(query)}`, $options: "i" } },
      ],
    };
    // .limit(parseInt(limit));
    //to test whether query uses COLLSCAN or IXSCAN

    //   .explain("executionStats");

    // console.log(users.executionStats.executionStages)

    if (role == "client") {
      baseQuery.role = "client";
    } else {
      baseQuery.role = "user";
    }

    const users = await User.find(baseQuery)
      .select("id name email role")
      .limit(parseInt(limit));

    res.status(200).json({
      status: "success",
      users,
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});

userRouter.get("/searchTeamMembers", async (req, res) => {
  const { userId, projectId, query = "", skills, limit = 10 } = req.query;
  const { project } = await validateAdminOrProjectManager(userId, projectId);
  const projectObj = project;

  let skillsArray = [];
  if (skills) {
    try {
      skillsArray = JSON.parse(skills);

      if (!Array.isArray(skillsArray)) {
        return res.status(400).json({
          status: "fail",
          message: "Skills must be a JSON array",
        });
      }
    } catch (err) {
      return res.status(400).json({
        status: "fail",
        message: "Invalid skills format. Must be a JSON array.",
      });
    }

    for (let i = 0; i < skillsArray.length; i++) {
      const skill = skillsArray[i];
      if (!skill.skillId || !skill.minLevel) {
        return res.status(400).json({
          status: "fail",
          message: `Skill ID and minimum level are required for skill at position ${
            i + 1
          }`,
        });
      }
      validateObjectId(skill.skillId, "Skill ID");
      const level = parseInt(skill.minLevel);
      if (isNaN(level) || level < 1 || level > 5) {
        return res.status(400).json({
          status: "fail",
          message: `Skill level must be between 1 and 5 for skill at position ${
            i + 1
          }`,
        });
      }
    }
  }

  const searchQuery = {
    _id: { $in: projectObj.teamMembers },
  };

  if (query.trim()) {
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const searchTerm = escapeRegex(query.trim());
    searchQuery.$or = [
      { name: { $regex: `^${searchTerm}`, $options: "i" } },
      { email: { $regex: `^${escapeRegex(query)}`, $options: "i" } },
    ];
  }

  // const skillConditions=skillsArray.map(skill=>({
  //   skills:{
  //     $elemMatch:{
  //       skillId:skill.skillId,
  //       level:{$gte:parseInt(skill.minLevel)}
  //     }
  //   }
  // }))

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
      // Only skills conditions
      // if (skillConditions.length === 1) {
      //   Object.assign(searchQuery, skillConditions[0]);
      // } else {
      searchQuery.$and = skillConditions;
      // }
    }
  }
  console.log("Search Query:", JSON.stringify(searchQuery, null, 2));

  // Execute the search
  const teamMembers = await User.find(searchQuery)
    .select("id name email role skills")
    .populate("skills.skillId", "name category")
    .limit(parseInt(limit))
    .sort({ name: 1 });

  const formattedTeamMembers = teamMembers.map((member) => {
    const relevantSkills = member.skills.filter((userSkill) =>
      skillsArray.some(
        (searchSkill) =>
          userSkill.skillId._id.toString() === searchSkill.skillId &&
          userSkill.level >= parseInt(searchSkill.minLevel)
      )
    );

    return {
      id: member._id,
      name: member.name,
      email: member.email,
      role: member.role,
      // matchingSkills: relevantSkills.map(skill => ({
      //   skillId: skill.skillId._id,
      //   skillName: skill.skillId.name,
      //   category: skill.skillId.category,
      //   level: skill.level,
      //   verified: skill.verified
      // })),
      // totalSkills: member.skills.length
    };
  });

  res.status(200).json({
    status: "success",
    data: {
      // projectName: project.projectName,
      // projectId: project._id,
      teamMembers: formattedTeamMembers,
      // totalFound: formattedTeamMembers.length,
      // searchCriteria: {
      //   skills: skillsArray,
      //   textQuery: query || null
      // }
    },
  });
});

export { userRouter };
