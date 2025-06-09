import mongoose from "mongoose";

const userWorkExceptionSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"],
        // unique: true,
    },
    date:{
        type: Date,
        required: [true, "Date is required"],
    },
    availableHours: {
        type: Number,
        required: [true, "Available hours are required"],
        min: [0, "Available hours cannot be negative"],
        max: [10, "Available hours cannot exceed 10"],

    },
    exceptionType: {
        type: String,
        required: [true, "Exception type is required"],
        enum: ["holiday", "sick leave", "vacation", "other"],
        default: "other"
    },
    reason:{
        type: String,
        required: [true, "Reason is required"],
        maxlength: [500, "Reason cannot exceed 500 characters"]
    },
    approved:{
        type:Boolean,
        default:false,
    },
    approvedBy:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    approvalDate:{
        type: Date,
    },
},{timestamps: true});

userWorkExceptionSchema.index({ userId: 1 }, { unique: false });

userWorkExceptionSchema.set("toJSON", {
    transform: function(doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
    }
})

const UserWorkException = mongoose.model("UserWorkException", userWorkExceptionSchema);
export default UserWorkException;