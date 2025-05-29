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
        // validate:{
        //     validator:function(value){
        //         const isValidDate = value instanceof Date && !isNaN(value);
        //         const isFutureDate = value > new Date();
        //         return isValidDate && isFutureDate;
        //     },
        //     message: "Date must be a valid date and in the future"
        // }
    },
    availableHours: {
        type: Number,
        required: [true, "Available hours are required"],
        min: [0, "Available hours cannot be negative"],
        max: [10, "Available hours cannot exceed 10"],
        // validate: {
        //     validator: function(value) {
        //         const isInteger=Number.isInteger(value);
        //         const inRange = value >= 0 && value <= 10;
        //         return isInteger && inRange;
        //     },
        //     message: "Available hours must be an integer"
        // }
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
    }
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