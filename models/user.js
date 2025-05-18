import mongoose from "mongoose";

const UserSchema=new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    role:{
        type:String,
        enum:['admin','user'],
        default:'user'
    },
    projects:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'Project'
    }]
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