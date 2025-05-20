import mongoose from "mongoose";

const taskSchema=new mongoose.Schema({
    taskName:{
        type:String,
        required:[true,'Task name is required'],
        immutable:true,
    },
    taskDescription:{
        type:String,
        required:[true,'Task description is required'],
    },
    project:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Project',
        required:[true,'Please assign the task to a project']
    },
    assignees:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'    
    }],
    status:{
        type:String,
        enum:['To Do','In Progress','Done'],
        default:'To Do'
    },
    priority:{
        type:String,
        enum:['Low','Medium','High'],
        default:'Medium'
    },
    dueDate:{
        type:Date,
        required:[true,'Due date is required'],
        validate:{
            validator:(value)=>{
                return value > Date.now()
            },
            message:'Due date must be in the future'
        }
    },
    files:[{
        type:String
    }]
},{timestamps:true})

taskSchema.set('toJSON',{
    transform:(doc,ret)=>{
        ret.id=ret._id.toString(),
        delete ret._id,
        delete ret.__v
    }
})

const Task=mongoose.model('Task',taskSchema)
export default Task