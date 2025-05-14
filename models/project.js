import mongoose from "mongoose";

const projectSchema=new mongoose.Schema({
    projectName:{
        type:String,
        required:true,
    },
    projectCode:{
        type:String,
        required:true,
        unique:true,
        immutable:true
    },
    description:{
        type:String
    },
    projectManager:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User',
        required:true
    },
    startDate:{
        type:Date,
        default:Date.now
    },
    endDate:{
        type:Date,
        required:true
    },
    budget:{
        type:Number,
        default:0
    },
    workflow:{
        type:String,
        enum:['Kanban','Classic']
    },
    teamMembers:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }]
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