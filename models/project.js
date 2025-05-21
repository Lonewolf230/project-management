import mongoose from "mongoose";
import { validate } from "uuid";

const projectSchema=new mongoose.Schema({
    projectName:{
        type:String,
        required:[true,'Project name is required'],
    },
    projectCode:{
        type:String,
        required:[true,'Project code is required'],
        unique:[true,'Project code must be unique'],
        immutable:true,
    },
    description:{
        type:String
    },
    projectManager:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:[true,'Project manager must be assigned']
    },
    startDate:{
        type:Date,
        default:Date.now
    },
    endDate:{
        type:Date,
        required:true,
        validate:{
            validator:function(value){
                return value > this.startDate
            },
            message:'End date must be greater than start date'
        }
    },
    budget:{
        type:Number,
        default:0,
        validate:{
            validator:(value)=>{
                return value >= 0
            },
            message:'Budget must be a positive number'
        }
    },
    workflow:{
        type:String,
        enum:['Kanban','Classic']
    },
    teamMembers:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
    }],
    client:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
    }
},{timestamps:true})

projectSchema.set('toJSON',{
    transform:(doc,ret)=>{
        ret.id=ret._id.toString(),
        delete ret._id,
        delete ret.__v
    }
})

const Project=mongoose.model('Project',projectSchema)
export default Project