import mongoose from "mongoose";
import { validateExists, validateSuperAdmin,validateObjectId, validateAdminOrProjectManager, validateForTaskDeletion, validateUploadTaskFiles, validateIndividualTaskViewAccess, validateTasksViewAccess, validateTaskUpdateAccess } from "../utils/validationUtils.js";
import User from "../models/user.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
jest.mock('../models/user.js')
jest.mock('../models/project.js')
jest.mock('../models/task.js')
// jest.mock('../utils/validationUtils.js')

describe('Validation Tests',()=>{

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('validate object ID',()=>{
        it('should not throw error for valid object id',()=>{
            expect(()=>validateObjectId('685c4daaa5576e7352b16657')).not.toThrow()
        })

        it('should throw error for invalid object id',()=>{
            expect(()=>validateObjectId('12345')).toThrow('ID is not a valid ObjectId')
        })

        it('should throw custom error message for invalid object id',()=>{
            expect(()=>validateObjectId('12345','User ID')).toThrow(
                expect.objectContaining({
                    message: 'User ID is not a valid ObjectId',
                    statusCode: 400,
                    status:'fail',
                    isOperational: true
                })
            )
        })
    })

    describe('validate existence',()=>{
        it('should return document for valid id',async()=>{
            const mockUser = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Test User'
            }

            User.findById.mockResolvedValue(mockUser);
            const result = await validateExists(User, '507f1f77bcf86cd799439012', 'User not found');
            expect(result).toEqual(mockUser);
            expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
        })

        it('should throw error for non-existing document',async()=>{
            User.findById.mockResolvedValue(null);
            await expect(validateExists(User, '507f1f77bcf86cd799439012', 'User not found')).rejects.toMatchObject({
                message: 'User not found',
                statusCode: 404,
                status: 'fail',
                isOperational: true
            })
        })
    })

    describe('validate super admin',()=>{
        it('should return user for valid super admin id',async()=>{
            const mockSuperAdmin = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Super Admin',
                role: 'super-admin'
            }

            User.findById.mockResolvedValue(mockSuperAdmin)
            const result = await validateSuperAdmin('507f1f77bcf86cd799439012');
            expect(result).toEqual(mockSuperAdmin);
            expect(User.findById).toHaveBeenCalledWith('507f1f77bcf86cd799439012');
        })

        it('should throw error for non-super admin id',async()=>{
            const mockFakeSuperAdmin={
                _id: '507f1f77bcf86cd799439013',
                name: 'Admin User',
                role: 'admin'
            }
            User.findById.mockResolvedValue(mockFakeSuperAdmin);
            await expect(validateSuperAdmin('507f1f77bcf86cd799439013')).rejects.toMatchObject({
                message: 'Only super admins can perform this action',
                statusCode: 403,
                status: 'fail',
                isOperational: true
            })
        })
    })

    describe('project level validations',()=>{
        it('validate admin or project manager',async()=>{
            const mockAdmin = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Admin User',
                role: 'admin'
            }

            const mockProject = {
                _id: '507f1f77bcf86cd799439013',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439012'
            }

            User.findById.mockResolvedValue(mockAdmin);
            Project.findById.mockResolvedValue(mockProject);

            const result = await validateAdminOrProjectManager('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013');
            expect(result).toMatchObject({
                user: mockAdmin,
                project: mockProject
            });
        })

        it('should not throw error if user is project manager',async()=>{
            const mockProjectManager = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Project Manager',
                role: 'user'
            }

            const mockProject = {
                _id: '507f1f77bcf86cd799439013',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439012'
            }

            User.findById.mockResolvedValue(mockProjectManager);
            Project.findById.mockResolvedValue(mockProject);

            const result = await validateAdminOrProjectManager('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013');
            expect(result).toMatchObject({
                user: mockProjectManager,
                project: mockProject
            });
        })

        it('should throw error if user is not admin or project manager',async()=>{
            const mockUser = {
                _id: '507f1f77bcf86cd799439014',
                name: 'Regular User',
                role: 'user'
            }

            const mockProject = {
                _id: '507f1f77bcf86cd799439015',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016'
            }

            User.findById.mockResolvedValue(mockUser);
            Project.findById.mockResolvedValue(mockProject);

            await expect(validateAdminOrProjectManager('507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015')).rejects.toMatchObject({
                message: 'Only admins or project managers can perform this action',
                statusCode: 403,
                status: 'fail',
                isOperational: true
            })
        })
    })

    describe('task deletion validations',()=>{
        it('should return user and task if user is admin or super admin',async()=>{
            const mockAdmin = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Admin User',
                role: 'admin'
            }

            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                name: 'Test Task'
            }

            User.findById.mockResolvedValue(mockAdmin);
            Task.findById.mockResolvedValue(mockTask);

            const result = await validateForTaskDeletion('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013');
            expect(result).toMatchObject({user: mockAdmin, task: mockTask});
        })

        it('should return user and task if user is project manager',async()=>{
            const mockProjectManager = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Project Manager',
                role: 'user'
            }

            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                name: 'Test Task',
                project: '6864ad7813d0c5339d058120'
            }

            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439012'
            }

            User.findById.mockResolvedValue(mockProjectManager);
            Task.findById.mockResolvedValue(mockTask);
            Project.findById.mockResolvedValue(mockProject);

            const result = await validateForTaskDeletion('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013');
            expect(result).toMatchObject({user: mockProjectManager, task: mockTask});
        })

        it('should throw error if user is not admin, super admin or project manager',async()=>{
            const mockUser = {
                _id: '507f1f77bcf86cd799439014',
                name: 'Regular User',
                role: 'user'
            }

            const mockTask = {
                _id: '507f1f77bcf86cd799439015',
                name: 'Test Task',
                project: '6864ad7813d0c5339d058120'
            }

            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439017'
            }

            User.findById.mockResolvedValue(mockUser);
            Task.findById.mockResolvedValue(mockTask);
            Project.findById.mockResolvedValue(mockProject);

            await expect(validateForTaskDeletion('507f1f77bcf86cd799439014', '507f1f77bcf86cd799439015')).rejects.toMatchObject({
                message: 'You do not have permission to delete this task',
                statusCode: 403,
                status: 'fail',
                isOperational: true
            })
        })
    })

    describe('task file upload validations',()=>{
        it('should return task if user is admin',async()=>{

            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }

            User.exists.mockResolvedValue(true);
            Project.exists.mockResolvedValue(false);
            Task.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockTask)
            });

            const result = await validateUploadTaskFiles('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013', '6864ad7813d0c5339d058120');
            expect(result).toEqual(mockTask);
        })

        it('should return task if user is project manager',async()=>{

            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }

            User.exists.mockResolvedValue(false);
            Project.exists.mockResolvedValue(true);
            Task.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockTask)
            });
            const result = await validateUploadTaskFiles('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013', '6864ad7813d0c5339d058120');
            expect(result).toEqual(mockTask);
        })

        it('should return task if user is assignee',async()=>{

            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }

            User.exists.mockResolvedValue(false);
            Project.exists.mockResolvedValue(false);
            Task.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockTask)
            });
            const result = await validateUploadTaskFiles('507f1f77bcf86cd799439014', '507f1f77bcf86cd799439013', '6864ad7813d0c5339d058120');
            expect(result).toEqual(mockTask);
        })

        it('should throw error if user is not admin, project manager or assignee',async()=>{
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }
            User.exists.mockResolvedValue(false);
            Project.exists.mockResolvedValue(false);
            Task.findById.mockReturnValue({
                select: jest.fn().mockResolvedValue(mockTask)
            });
            await expect(validateUploadTaskFiles('507f1f77bcf86cd799439015', '507f1f77bcf86cd799439013', '6864ad7813d0c5339d058120')).rejects.toMatchObject({
                message: 'You do not have permission to upload files to this task',
                statusCode: 403,
                status: 'fail',
                isOperational: true
            });
        })
    })

    describe('task view access validations',()=>{
        it('should return user if admin or super admin',async()=>{
            const mockAdmin = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Admin User',
                role: 'admin'
            }

            User.findById.mockResolvedValue(mockAdmin);
            const result = await validateIndividualTaskViewAccess('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013');
            expect(result).toEqual(mockAdmin);
        })

        it('should return task if user is project manager ',async()=>{
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }

            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439018'
            }
            const mockUser = {
                _id: '507f1f77bcf86cd799439016',
                name: 'Project Manager',
                role: 'user'
            }
            Task.findById.mockResolvedValue(mockTask);
            User.findById.mockResolvedValue(mockUser);
            Project.findById.mockResolvedValue(mockProject);
            const result = await validateIndividualTaskViewAccess('507f1f77bcf86cd799439016', '507f1f77bcf86cd799439013');
            expect(result).toMatchObject({
                user: mockUser,
                task: mockTask,
                project: mockProject
            });
        })

        it('should return task if user is assignee',async()=>{
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }

            const mockUser = {
                _id: '507f1f77bcf86cd799439014',
                name: 'Regular User',
                role: 'user'
            }

            const mockProject={
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439018'
            }

            User.findById.mockResolvedValue(mockUser);
            Project.findById.mockResolvedValue(mockProject);
            Task.findById.mockResolvedValue(mockTask);

            const result = await validateIndividualTaskViewAccess('507f1f77bcf86cd799439014', '507f1f77bcf86cd799439013');
            expect(result).toMatchObject({
                user: mockUser,
                task: mockTask,
                project: mockProject
            });
        })


        it('should return task if user is client',async()=>{
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }

            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439018'
            };

            const mockUser = {
                _id: '507f1f77bcf86cd799439018',
                name: 'Client User',
                role: 'client'
            }

            User.findById.mockResolvedValue(mockUser);
            Project.findById.mockResolvedValue(mockProject);
            Task.findById.mockResolvedValue(mockTask);

            const result = await validateIndividualTaskViewAccess('507f1f77bcf86cd799439018', '507f1f77bcf86cd799439013');
            expect(result).toMatchObject({
                user: mockUser,
                task: mockTask,
                project: mockProject
            });
        })

        it('should throw error if user does not have access to project',async()=>{
            const mockUser = {
                _id: '507f1f77bcf86cd799439014',
                name: 'Regular User',
                role: 'user'
            }

            const mockProject = {
                _id: '507f1f77bcf86cd799439015',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439018'
            }

            const mockTask = {
                _id: '507f1f77bcf86cd799439019',
                project: '507f1f77bcf86cd799439015',
                assignees: ['507f1f77bcf86cd799439014']
            }

            User.findById.mockResolvedValue(mockUser);
            Project.findById.mockResolvedValue(mockProject);
            Task.findById.mockResolvedValue(mockTask);

            await expect(validateIndividualTaskViewAccess('507f1f77bcf86cd799439017', '507f1f77bcf86cd799439019')).rejects.toMatchObject({
                message: 'You do not have permission to access this task',
                statusCode: 403,
                status: 'fail',
                isOperational: true
            })
        })
    }),
    describe('task update validations',()=>{
        it('should return task, project and user if user is admin or super admin',async()=>{
            const mockAdmin = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Admin User',
                role: 'admin'
            }
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }
            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439018'
            }

            User.findById.mockResolvedValue(mockAdmin);
            Task.findById.mockResolvedValue(mockTask);
            Project.findById.mockResolvedValue(mockProject);

            const result = await validateTaskUpdateAccess('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013', {});
            expect(result).toMatchObject({
                user: mockAdmin,
                task: mockTask,
                project: mockProject
            });
        })
        it('should return task, project and user if user is project manager',async()=>{
            const mockProjectManager = {
                _id: '507f1f77bcf86cd799439012',
                name: 'Project Manager',
                role: 'user'
            }
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }
            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439012',
                client: '507f1f77bcf86cd799439018'
            }

            User.findById.mockResolvedValue(mockProjectManager);
            Task.findById.mockResolvedValue(mockTask);
            Project.findById.mockResolvedValue(mockProject);

            const result = await validateTaskUpdateAccess('507f1f77bcf86cd799439012', '507f1f77bcf86cd799439013', {});
            expect(result).toMatchObject({
                user: mockProjectManager,
                task: mockTask,
                project: mockProject
            });
        })

        it('should return task, project and user if user is assignee and performs allowed actions',async()=>{
            const updateData={
                taskDescription: 'Updated task description',
                status: 'In Progress'
            }
            const mockAssignee = {
                _id: '507f1f77bcf86cd799439014',
                name: 'Assignee User',
                role: 'user'
            }
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }
            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439018'
            }
            User.findById.mockResolvedValue(mockAssignee);
            Task.findById.mockResolvedValue(mockTask);
            Project.findById.mockResolvedValue(mockProject);
            const result = await validateTaskUpdateAccess('507f1f77bcf86cd799439014', '507f1f77bcf86cd799439013', updateData);
            expect(result).toMatchObject({
                user: mockAssignee,
                task: mockTask,
                project: mockProject
            });
        })

        it('should throw error if user is assignee and tries to perform disallowed actions',async()=>{
            const updateData={
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439030'],
            }
            const mockAssignee = {
                _id: '507f1f77bcf86cd799439014',
                name: 'Assignee User',
                role: 'user'
            }
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }
            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439018'
            }
            User.findById.mockResolvedValue(mockAssignee);
            Task.findById.mockResolvedValue(mockTask);
            Project.findById.mockResolvedValue(mockProject);
            await expect(validateTaskUpdateAccess('507f1f77bcf86cd799439014', '507f1f77bcf86cd799439013', updateData)).rejects.toMatchObject({
                message: 'You do not have permission to update restricted fields',
                statusCode: 403,
                status: 'fail',
                isOperational: true
            })
        })

        it('should throw error if user is not admin, project manager or assignee',async()=>{
            const mockUser = {
                _id: '507f1f77bcf86cd799439015',
                name: 'Non-Assignee User',
                role: 'client'
            }
            const mockTask = {
                _id: '507f1f77bcf86cd799439013',
                project: '6864ad7813d0c5339d058120',
                assignees: ['507f1f77bcf86cd799439014']
            }
            const mockProject = {
                _id: '6864ad7813d0c5339d058120',
                name: 'Test Project',
                projectManager: '507f1f77bcf86cd799439016',
                client: '507f1f77bcf86cd799439015'
            }
            User.findById.mockResolvedValue(mockUser);
            Task.findById.mockResolvedValue(mockTask);
            Project.findById.mockResolvedValue(mockProject);
            await expect(validateTaskUpdateAccess('507f1f77bcf86cd799439015', '507f1f77bcf86cd799439013', {})).rejects.toMatchObject({
                message: 'You do not have permission to update this task',
                statusCode: 403,
                status: 'fail',
                isOperational: true
            });
        })
    })
    
    
})

