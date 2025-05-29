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
    skills:[{
        skillId:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'Skill',
            required:[true,'Skill ID is required']
        },
        level:{
            type:Number,
            min:1,
            max:5,
            required:[true,'Skill level is required'],
            validate:{
                validator:Number.isInteger,
                message:'Skill level must be an integer between 1 and 5',
            }
        },
        verified:{
            type:Boolean,
            default:false
        },
        evaluatedBy:{
            type:mongoose.Schema.Types.ObjectId,
            ref:'User',
            validate:{
                validator:async function(value){
                    return await User.exists({_id:value,role:{$eq:'admin'}})
                },
                message:'Evaluator must be an admin'
            }
        }
    }]
},{timestamps:true})

UserSchema.index({name:1})

UserSchema.set('toJSON',{
    transform:(doc,ret)=>{
        ret.id=ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.createdAt;
        delete ret.updatedAt;
    }
})

const User=mongoose.model('User',UserSchema)
export default User