import express from "express";
import Tag from "../models/tag.js";

const tagRouter = express.Router();

tagRouter.get("/all", async (req, res) => {
    const tags = await Tag.find({})
    return res.status(200).json({
        status: "success",
        tags,
    });
});

export {tagRouter};