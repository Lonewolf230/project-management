import User from "../models/user.js";
import express from "express";
import {
  validateAdmin,
  validateAdminExists,
  validateAdminOrProjectManager,
  validateExists,
  validateObjectId,
  validateSuperAdmin,
} from "../utils/validationUtils.js";
import { canUserHandleTask, canUsersHandleTask, getDayName } from "../utils/workloadUtils.js";
import UserWorkException from "../models/userWorkException.js";
import { buildSearchQuery, catchAsync, parseSelectedUserIds, validateSearchTaskDates, validateSkills, validateSkillsArrayAndLength, validateUserCreationSkills } from "../utils/helper.js";
import { hashPassword, randomPasswordGenerator } from "../utils/authUtils.js";
import { emailQueue } from "../jobs/emailQueue.js";
import Skill from "../models/skill.js";
const userRouter = express.Router();

userRouter.post("/create", catchAsync(async (req, res) => {
  const { name, email, role } = req.body;
  const adminId=req.user;
  if(role == 'admin' || role == 'super-admin'){
    await validateSuperAdmin(adminId);
  }
  else await validateAdmin(adminId);

  const password=randomPasswordGenerator();
  const hashedPassword=await hashPassword(password);
  const user = await User.create({
    name,
    email,
    role,
    password:hashedPassword
  });
  // await sendUserEmail(email,name,role,password,email)
  await emailQueue.add("send-email",{
    toEmail: email,
    toName: name,
    role:role || 'user',
    password,
    username: email
  })
  res.status(201).json({
    status: "success",
    message: "User created successfully"    
  });
}));

userRouter.patch("/updateInfo",catchAsync(async (req, res) => {
  const userId = req.user;
  const { name,skills } = req.body;

  validateObjectId(userId, "User ID");
  const user=await validateExists(User, userId, "User not found");
  if((user.id.toString() !== userId.toString()) && user.role !== "admin" && user.role !== "super-admin"){
    return res.status(403).json({
      status: "fail",
      message: "You are not authorized to update this user",
    });
  }
  const lenSkills=await Skill.countDocuments();
  // if (role && role !== "user" && role !== "admin" && role !== "client") {
  //   return res.status(400).json({
  //     status: "fail",
  //     message: "Invalid role provided",
  //   });
  // }

  if (skills) {
    validateSkillsArrayAndLength(skills,lenSkills);
    validateUserCreationSkills(skills);
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { name, skills },
    { new: true }
  ).select("id name email role skills");

  res.status(200).json({
    status: "success",
    message: "User information updated successfully",
    user: updatedUser,
  });
}))

userRouter.get("/allUsers",catchAsync(async (req, res) => {
  const userId=req.user;
  console.log(`User ID: ${userId}`);
  
  await validateAdminExists(userId);
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
  
}));

userRouter.get("/searchUsers",catchAsync(async (req, res) => {
  const {  query = "", limit = 10, role = "" } = req.query;
  console.log(query);
  const adminId=req.user;
  
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
      count: users.length,
      message: users.length == 0 ? "No users found" : "Users found",
      users,
    });
  
}));

userRouter.post("/applyForLeave",catchAsync(async (req, res) => {
  const userId = req.user;
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
}));

userRouter.patch("/approveLeave",catchAsync(async(req,res)=>{
  const {leaveId}=req.query;
  const adminId=req.user;
  validateObjectId(adminId, "Admin ID")
  validateObjectId(leaveId, "Leave ID")
  validateAdminExists(adminId)

  await UserWorkException.findByIdAndUpdate(leaveId,{
    approved:true,
    approvedBy:adminId,
    approvalDate: new Date(),
  }, {new:true})

  return res.status(200).json({
    status: "success",
    message: "Leave application approved successfully",
  });
}))

userRouter.delete("/cancelLeave", catchAsync(async(req,res)=>{
  const {leaveId}=req.query;
  const userId=req.user;
  validateObjectId(userId, "User ID")
  validateObjectId(leaveId, "Leave ID")
  await validateExists(UserWorkException, leaveId, "Leave not found")

  await UserWorkException.findByIdAndDelete(leaveId)

  return res.status(200).json({
    status: "success",
    message: "Leave application cancelled successfully",
  });
}))

userRouter.get("/getLeaves", catchAsync(async (req, res) => {
  const userId = req.user;
  const user= await validateExists(User, userId, "User not found");
  let leaves;
  if(user.role=='client'){
    return res.status(403).json({
      status: "fail",
      message: "Clients cannot view leaves",
    });
  }
  else if(user.role=='user'){
    leaves= await UserWorkException.find({userId}).sort({date:-1});
  }
  else if(user.role=='admin' || user.role=='super-admin'){
    leaves= await UserWorkException.find().sort({date:-1});
  }
  if (leaves.length === 0) {
    return res.status(200).json({
      status: "fail",
      leaves: [],
      count: 0,
      message: "No leaves found",
    });
  }
  // await leaves.populate("userId", "name email role");
  await UserWorkException.populate(leaves,{
    path:"userId",
    select:"name email role"
  })
  res.status(200).json({
    status: "success",
    message: "Leaves fetched successfully",
    count: leaves.length,
    leaves,
  });
}))

userRouter.get("/searchTeamMembers", async (req, res) => {
  try {
    const {
      projectId,
      query = "",
      skills,
      limit = 15, 
      requiredHours,
      taskStartDate,
      taskEndDate,
      selectedUserIds, 
      includeWorkload = "true",
      calculationMode = "individual", // "individual" or "team"
      distributionStrategy = "equal"
    } = req.query;
    const userId = req.user;
    console.log("Search request parameters:", {
      userId, projectId, query, skills, limit,
      requiredHours, taskStartDate, taskEndDate,
      selectedUserIds, includeWorkload, calculationMode, distributionStrategy
    });

    const { project } = await validateAdminOrProjectManager(userId, projectId);
    const projectObj = project;

    let selectedUsers = [];
    selectedUsers=parseSelectedUserIds(selectedUsers,selectedUserIds)

    let skillsArray = [];
    skillsArray=validateSkills(skillsArray,skills)
    console.log(`Skills Array: ${skillsArray}`)

    if (includeWorkload === "true" && requiredHours) {
      validateSearchTaskDates(taskStartDate, taskEndDate, requiredHours);
    }
    const searchQuery=buildSearchQuery(projectObj.teamMembers, query,skillsArray)

    console.log("Search Query:", JSON.stringify(searchQuery, null, 2));

    const teamMembers = await User.find(searchQuery)
      .select("id name email role skills")
      .populate("skills.skillId", "name category")
      .limit(parseInt(limit))
      .sort({ name: 1 });

    console.log(`Found ${teamMembers.length} team members`);

    let formattedTeamMembers = teamMembers.map((member) => ({
      id: member._id,
      name: member.name,
      email: member.email,
      role: member.role,
      isSelected: selectedUsers.includes(member._id.toString())
    }));

    if (includeWorkload === "true" && requiredHours && taskStartDate && taskEndDate) {
      console.log("Starting workload calculations...");
      const hours = parseFloat(requiredHours);

      if (calculationMode === "team" && selectedUsers.length > 0) {
        console.log("Team mode calculation for selected users");
        
        const teamAnalysis = await canUsersHandleTask(
          selectedUsers,
          new Date(taskStartDate),
          new Date(taskEndDate),
          hours,
          distributionStrategy
        );

        const teamResults = {
          canAssignToTeam: teamAnalysis.canAssignToTeam,
          totalHours: hours,
          distributionStrategy,
          individualResults: teamAnalysis.individualResults,
          failedUsers: teamAnalysis.failedUsers,
          summary: teamAnalysis.summary,
          teamCapacity: {
            totalCapacity: teamAnalysis.individualResults.reduce((sum, r) => sum + (r.capacity?.total || 0), 0),
            totalAllocated: teamAnalysis.individualResults.reduce((sum, r) => sum + (r.capacity?.allocated || 0), 0),
            totalAvailable: teamAnalysis.individualResults.reduce((sum, r) => sum + (r.capacity?.available || 0), 0),
          }
        };

        formattedTeamMembers = formattedTeamMembers.map(member => {
          const teamResult = teamAnalysis.individualResults.find(r => r.userId.toString() === member.id.toString());
          
          if (teamResult && member.isSelected) {
            return {
              ...member,
              workloadInfo: {
                canHandle: teamResult.canHandle,
                hoursAssigned: teamResult.hoursNeeded,
                currentUtilization: `${teamResult.utilization.current}%`,
                projectedUtilization: `${teamResult.utilization.afterAssignment}%`,
                utilizationIncrease: `${teamResult.utilization.increase}%`,
                availableCapacity: `${teamResult.capacity.available} hours`,
                totalCapacity: `${teamResult.capacity.total} hours`,
                surplus: teamResult.capacity.surplus >= 0 ? `${teamResult.capacity.surplus} hours` : null,
                workingDays: teamResult.taskPeriod.workingDays,
                hoursPerDay: teamResult.suggestedAllocation ? `${teamResult.suggestedAllocation.hoursPerDay} hours` : null,
              }
            };
          }
          return member;
        });

        return res.status(200).json({
          status: "success",
          count: formattedTeamMembers.length,
          teamMembers: formattedTeamMembers,
          teamAnalysis: teamResults,
          mode: "team"
        });

      } else {
        console.log("Individual mode calculation");
        
        const totalSelectedUsers = Math.max(selectedUsers.length, 0);
        const hoursPerUser = hours / totalSelectedUsers;

        const workloadPromises = formattedTeamMembers.map(async (member) => {
          try {
            //for each user he is the only one involved in the task(assumption)
            const calculationUsers = member.isSelected ? totalSelectedUsers : totalSelectedUsers + 1;
            const calculationHours = hours / calculationUsers;

            console.log(`Checking individual workload for user ${member.id} (${member.name}) - ${calculationHours} hours`);

            const capacityCheck = await canUserHandleTask(
              member.id,
              new Date(taskStartDate),
              new Date(taskEndDate),
              calculationHours
            );

            return {
              ...member,
              workloadInfo: {
                canHandle: capacityCheck.canHandle,
                hoursAssigned: calculationHours,
                currentUtilization: `${capacityCheck.utilization?.current || 0}%`,
                projectedUtilization: `${capacityCheck.utilization?.afterAssignment || 0}%`,
                utilizationIncrease: `${capacityCheck.utilization?.increase || 0}%`,
                availableCapacity: `${capacityCheck.capacity?.available || 0} hours`,
                totalCapacity: `${capacityCheck.capacity?.total || 0} hours`,
                surplus: capacityCheck.capacity?.surplus >= 0 ? 
                        `${capacityCheck.capacity?.surplus || 0} hours` : null,
                workingDays: capacityCheck.taskPeriod?.workingDays || 0,
                hoursPerDay: capacityCheck.suggestedAllocation ? 
                           `${capacityCheck.suggestedAllocation.hoursPerDay} hours` : null,
                isPreview: !member.isSelected // tells if this is a preview or simulation for unselected users
              },
            };
          } catch (error) {
            console.error(`Error checking workload for user ${member.id}:`, error);
            if (error.isOperational) {
              return res.status(error.statusCode).json({
                status: error.status,
                message: error.message,
              });
            }
            return {
              ...member,
              workloadInfo: {
                canHandle: false,
                error: error.message || "Error calculating workload",
                hoursAssigned: hoursPerUser
              }
            };
          }
        });

        const workloadResults = await Promise.all(workloadPromises);
        formattedTeamMembers = workloadResults;

        formattedTeamMembers.sort((a, b) => {
          const utilizationA = parseInt(a.workloadInfo?.currentUtilization || "0");
          const utilizationB = parseInt(b.workloadInfo?.currentUtilization || "0");
          return utilizationA - utilizationB;
        });

        return res.status(200).json({
          status: "success",
          count: formattedTeamMembers.length,
          teamMembers: formattedTeamMembers,
          selectedCount: selectedUsers.length,
          hoursPerUserSelected: hours/(selectedUsers.length+1),
          mode: "individual"
        });
      }
    }

    // No wrokload calculations, return basic info
    res.status(200).json({
      status: "success",
      count: formattedTeamMembers.length,
      teamMembers: formattedTeamMembers,
      selectedCount: selectedUsers.length,
      mode: "basic"
    });

  } catch (error) {
    console.error("Error in searchTeamMembers:", error);
    if (error.isOperational) {
      return res.status(error.statusCode).json({
        status: error.status,
        message: error.message,
      });
    }
    res.status(500).json({
      status: "error",
      message: "Internal server error while searching team members",
      error: error.message,
    });
  }
});


export { userRouter };
