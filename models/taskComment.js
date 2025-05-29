import mongoose from 'mongoose'

const taskCommentSchema = new mongoose.Schema({
    taskId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: [true,'Task ID is required']
    },
    comments: [{
        content:{
            type: String,
            required: [true, 'Comment content is required'],
            maxlength: [500, 'Comment cannot exceed 500 characters'],
            minlength: [1, 'Comment must be at least 1 character long']
        },
        isDeleted:{
            type: Boolean,
            default: false
        },
        parentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TaskComment',
            default: null
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: [true, 'User ID is required']
        },
        level: {
            type: Number,
            default: 0,
            validate: {
                validator: function(value) {
                    return value >= 0;
                },
                message: 'Level must be a non-negative integer'
            }
        },
        createdAt:{
            type: Date,
            default: Date.now
        },
        updatedAt:{
            type: Date,
            default: Date.now
        }
    }]

},{timestamps: true})

taskCommentSchema.index({ taskId: 1})
taskCommentSchema.index({ 'comments.userId': 1 })
taskCommentSchema.index({ 'comments.parentId': 1 })

taskCommentSchema.set('toJSON', {
    transform: (doc, ret) => {
        ret.id = ret._id.toString()
        delete ret._id
        delete ret.__v
        return ret
    }
})

const TaskComment = mongoose.model('TaskComment', taskCommentSchema)
export default TaskComment