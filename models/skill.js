import mongoose, { mongo } from "mongoose";

const skillSchema=new mongoose.Schema({
    name:{
        type:String,
        required:[true,'Skill name is required'],
        unique:[true,'Skill name must be unique'],
        validate:{
            validator:(value)=>{
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
            },
            message:'Please provide a valid skill name'
        }
    },
    category:{
        type:String,
        enum:['Technical','Non-Technical'],
        required:[true,'Skill category is required'],
        validate:{
            validator:(value)=>{
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
            },
            message:'Please provide a valid skill category'
        }
    }
})

skillSchema.set('toJSON',{
    transform:(doc,ret)=>{
        ret.id=ret._id.toString(),
        delete ret._id,
        delete ret.__v,
        delete ret.createdAt,
        delete ret.updatedAt
    }
})

const Skill=mongoose.model('Skill',skillSchema)
export default Skill