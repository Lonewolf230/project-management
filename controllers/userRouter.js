import Skill from "../models/skill.js";
import User from "../models/user.js";
import express from "express";
import {
  validateAdminExists,
  validateAdminOrProjectManager,
  validateExists,
  validateObjectId,
} from "../utils/validationUtils.js";
import { errors } from "../utils/appError.js";
import { canUserHandleTask, getDayName } from "../utils/workloadUtils.js";
import UserWorkException from "../models/userWorkException.js";
const userRouter = express.Router();

userRouter.post("/create", async (req, res) => {
  const { name, email, role, skills } = req.body;
  if (!skills || !Array.isArray(skills)) {
    return res.status(400).json({
      status: "fail",
      message: "Skills array is required",
    });
  }

  if (skills.length !== 6) {
    return res.status(400).json({
      status: "fail",
      message: "Exactly 6 skills must be provided",
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

  if (existingSkills.length !== 6) {
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
  try {
    const {
      userId,
      projectId,
      query = "",
      skills,
      limit = 10,
      requiredHours,
      taskStartDate,
      taskEndDate,
      includedWorkload = "true",
    } = req.query;

    console.log("Search request parameters:", {
      userId,
      projectId,
      query,
      skills,
      limit,
      requiredHours,
      taskStartDate,
      taskEndDate,
      includedWorkload,
    });

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
      } catch (error) {
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

    if (includedWorkload === "true" && requiredHours) {
      if (!taskStartDate || !taskEndDate) {
        return res.status(400).json({
          status: "fail",
          message:
            "Task start date and end date are required when required hours is provided",
        });
      }

      const hours = parseFloat(requiredHours);
      if (isNaN(hours) || hours <= 0) {
        return res.status(400).json({
          status: "fail",
          message: "Required hours must be a positive number",
        });
      }

      const startDate = new Date(taskStartDate);
      const endDate = new Date(taskEndDate);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return res.status(400).json({
          status: "fail",
          message: "Invalid start or end date format. Use YYYY-MM-DD",
        });
      }
      if (startDate >= endDate) {
        return res.status(400).json({
          status: "fail",
          message: "Start date must be before end date",
        });
      }

      console.log("Workload validation passed:", { hours, startDate, endDate });
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

    console.log("Search Query:", JSON.stringify(searchQuery, null, 2));

    const teamMembers = await User.find(searchQuery)
      .select("id name email role skills")
      .populate("skills.skillId", "name category")
      .limit(parseInt(limit))
      .sort({ name: 1 });

    console.log(
      `Found ${teamMembers.length} team members before workload filtering`
    );

    let formattedTeamMembers = teamMembers.map((member) => {
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
      };
    });

    if (
      includedWorkload === "true" &&
      requiredHours &&
      taskStartDate &&
      taskEndDate
    ) {
      console.log("Starting workload filtering...");

      const workloadPromises = formattedTeamMembers.map(async (member) => {
        try {
          console.log(
            `Checking workload for user ${member.id} (${member.name})`
          );

          const capacityCheck = await canUserHandleTask(
            member.id,
            new Date(taskStartDate),
            new Date(taskEndDate),
            parseFloat(requiredHours)
          );

          console.log(`Capacity check result for ${member.name}:`, {
            canHandle: capacityCheck.canHandle,
            error: capacityCheck.error,
            totalAvailable: capacityCheck.capacity?.available,
            totalCapacity: capacityCheck.capacity?.total,
            hoursNeeded: capacityCheck.hoursNeeded,
          });

          // if (capacityCheck.canHandle) {
            return {
              ...member,
              workloadInfo: {
                canHandle: capacityCheck.canHandle,
                currentUtilization: `${capacityCheck.utilization.current}%`,
                projectedUtilization: `${capacityCheck.utilization.afterAssignment}%`,
                utilizationIncrease: `${capacityCheck.utilization.increase}%`,
                availableCapacity: `${capacityCheck.capacity.available} hours`,
                totalCapacity: `${capacityCheck.capacity.total} hours`,
                surplus: capacityCheck.capacity.surplus>=0 ? 
                        `${capacityCheck.capacity.surplus} hours`:null,
                workingDays: capacityCheck.taskPeriod.workingDays,
                hoursPerDay: capacityCheck.suggestedAllocation
                  ? `${capacityCheck.suggestedAllocation.hoursPerDay} hours`
                  : null,
                
              },
            };
          // } 
          // else {
          //   console.log(
          //     `Excluded ${member.name}: ${
          //       capacityCheck.error || "Insufficient capacity"
          //     }`
          //   );
          //   return null;
          // }
        } catch (error) {
          console.error(
            `Error checking workload for user ${member.id} (${member.name}):`,
            error
          );
          return null;
        }
      });

      const workloadResults=await Promise.all(workloadPromises)

      formattedTeamMembers=workloadResults
      // console.log(
      //   `Workload filtering complete. ${workloadFilteredMembers.length} members remaining.`
      // );
    }

    if (
      includedWorkload === "true" &&
      formattedTeamMembers.length > 0 &&
      formattedTeamMembers[0].workloadInfo
    ) {
      formattedTeamMembers.sort((a, b) => {
        const utilizationA = parseInt(a.workloadInfo.currentUtilization);
        const utilizationB = parseInt(b.workloadInfo.currentUtilization);
        return utilizationA - utilizationB;
      });
    }

    const response = {
      status: "success",
      count: formattedTeamMembers.length,
      teamMembers: formattedTeamMembers,
    };

    // if (includedWorkload === 'true' && requiredHours) {
    //     response.searchCriteria = {
    //         requiredHours: parseFloat(requiredHours),
    //         taskStartDate,
    //         taskEndDate,
    //         skillsRequired: skillsArray.length,
    //         workloadFilterApplied: true
    //     };
    // }

    console.log("Final response:", {
      status: response.status,
      count: response.count,
      searchCriteria: response.searchCriteria,
    });

    res.status(200).json(response);
  } catch (error) {
    console.error("Error in searchTeamMembers:", error);
    res.status(500).json({
      status: "error",
      message: "Internal server error while searching team members",
      error: error.message,
    });
  }
});

userRouter.post("/applyForLeave", async (req, res) => {
  const { userId } = req.query;
  const { date, availableHours, exceptionType, reason } = req.body;
  validateExists(User, userId, "User not found");

  if (!date || !availableHours || !exceptionType || !reason) {
    return res.status(400).json({
      status: "fail",
      message: "All fields are required",
    });
  }
  const applyDate = new Date(date);
  if (isNaN(applyDate.getTime())) {
    return res.status(400).json({
      status: "fail",
      message: "Invalid date format",
    });
  }
  if (applyDate < new Date()) {
    return res.status(400).json({
      status: "fail",
      message: "Cannot apply for leave in the past",
    });
  }
  const dayName = getDayName(applyDate);
  console.log(`Applying for leave on ${dayName}`);

  if (dayName === "Saturday" || dayName === "Sunday") {
    return res.status(400).json({
      status: "fail",
      message: "Cannot apply for leave on weekends",
    });
  }

  const leave = await UserWorkException.create({
    userId,
    date: applyDate,
    availableHours: parseFloat(availableHours),
    exceptionType,
    reason,
  });

  res.status(201).json({
    status: "success",
    message: "Leave application submitted successfully",
    leave,
  });
});

export { userRouter };
