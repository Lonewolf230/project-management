import User from "../models/user.js";
import express from "express";
const userRouter = express.Router();

userRouter.post("/create", async (req, res) => {
  const { name, email, role } = req.body;

  try {
    const user = await User.create({
      name,
      email,
      role,
      projects: [],
    });
    res.status(201).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
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
  const { adminId, query = "", limit = 10 } = req.query;
  console.log(query);

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
        message: "Only admins can search users",
      });
    }
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const users = await User.find({
        $or: [
          { name: { $regex: `^${escapeRegex(query)}`, $options: "i" } },
          { email: { $regex: `^${escapeRegex(query)}`, $options: "i" } },
        ],
    })
      .select("id name email")
      .limit(parseInt(limit))
    //to test whether query uses COLLSCAN or IXSCAN

    //   .explain("executionStats");

    // console.log(users.executionStats.executionStages)

    res.status(200).json({
      status: "success",
      users
    });
  } catch (error) {
    res.status(400).json({
      status: "fail",
      message: error.message,
    });
  }
});


export { userRouter };
