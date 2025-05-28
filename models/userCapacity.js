import mongoose from "mongoose";

const userCapacitySchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,
    },
    dailyCapacity: {
        type: Number,
        default:8,
        min: 0,
        max :10
    },
    weeklyCapacity: {
        type: Number,
        default: 40,
        min: 0,
        max :50
    },
    workingDaysPerWeek:{
        type:[String],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    }
},{timestamps: true});

// userCapacitySchema.index({ userId: 1 }, { unique: true });

userCapacitySchema.set("toJSON", {
    transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
    }
})

const UserCapacity = mongoose.model("UserCapacity", userCapacitySchema);
export default UserCapacity;