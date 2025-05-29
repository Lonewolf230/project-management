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
    startDate:{
        type:Date,
        required:[true,'Start date is required'],
        validate:function(value){
            return value >= Date.now();
        },
        message:'Start date must be today or in the future'
    },
    dueDate:{
        type:Date,
        required:[true,'Due date is required'],
        validate:{
            validator:function(value){
                return  value>this.startDate && value > Date.now()
            },
            message:'Due date must be in the future and later than startDate'
        }
    },
    files:[{
        type:String
    }],
    requiredSkills:[{
        skillId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Skill',
            required:[true,'Skill ID is required']
        },
        minLevel:{
            type:Number,
            min:1,
            max:5,
            required:[true,'Minimum skill level is required'],
            validate:{
                validator:Number.isInteger,
                message:'Minimum skill level must be an integer between 1 and 5'
            }
        },
    }],
    tags:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Tag'
    }],
    estimatedHours:{
        type:Number,
        required:[true,'Estimated hours are required'],
        min:0,
        // validate:{
        //     validator:{
        //         validator:function(value){
        //             return Number.isInteger(value) && value >= 0;
        //         }
        //     },
        //     message:'Estimated hours must be a non-negative integer'
        // }
    },
},{timestamps:true})

taskSchema.set('toJSON',{
    virtuals:true,
    versionKey:false,
    transform:(doc,ret)=>{
        ret.id=ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
        return ret;
    }
})

const Task=mongoose.model('Task',taskSchema)
export default Task