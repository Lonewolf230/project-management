import mongoose from "mongoose";

const UserSchema=new mongoose.Schema({
    name:{
        type:String,
        required:[true,'Name is required'],
    },
    email:{
        type:String,
        required:[true,'Email is required'],
        unique:[true,'Email is already registered'],
        validate:{
            validator:(value)=>{
                return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)
            },
            message:'Please provide a valid email address'
        }
    },
    role:{
        type:String,
        enum:['admin','user','client'],
        default:'user'
    },
},{timestamps:true})

UserSchema.index({name:1})

UserSchema.set('toJSON',{
    transform:(doc,ret)=>{
        ret.id=ret._id.toString(),
        delete ret._id,
        delete ret.__v
    }
})

const User=mongoose.model('User',UserSchema)
export default User