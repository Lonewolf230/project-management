import Task from "../models/task.js"
import UserCapacity from "../models/usercapacity.js"
import UserWorkException from "../models/userWorkException.js"
import { errors } from "./appError.js"

const userCapacityCache = new Map()
const CACHE_DURATION = 2 * 60 * 1000

function getDateRange(startDate, endDate) {
    const dates = []
    const start = new Date(startDate)
    const end = new Date(endDate)

    const currentDate = new Date(start)
    while (currentDate <= end) {
        dates.push(new Date(currentDate))
        currentDate.setDate(currentDate.getDate() + 1)
    }
    return dates
}

function getDayName(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' })
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

async function getUserCapacityData(userId) {
    const cacheKey = userId.toString()
    const cached = userCapacityCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
        return cached.data
    }

    let capacity = await UserCapacity.findOne({ userId })

    if (!capacity) {
        capacity = await UserCapacity.create({
            userId,
            dailyCapacity: 8,
            weeklyCapacity: 40,
            workingDaysPerWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        })
    }

    userCapacityCache.set(cacheKey, {
        data: capacity,
        timestamp: Date.now()
    })
    return capacity
}

async function getWorkingDaysBetween(userId, startDate, endDate) {
    const userCapacity = await getUserCapacityData(userId)
    const userWorkingDays = userCapacity.workingDaysPerWeek

    const exceptions = await UserWorkException.find({
        userId,
        date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    })

    const exceptionMap = new Map()
    exceptions.forEach(exception => {
        exceptionMap.set(formatDate(exception.date), exception)
    })

    const dates = getDateRange(startDate, endDate)
    let workingDays = 0

    for (const date of dates) {
        const dayName = getDayName(date)
        const dateStr = formatDate(date)
        const exception = exceptionMap.get(dateStr)

        // if (exception) {
        //     if (exception.availableHours > 0) {
        //         workingDays++
        //     }
        // }
        // else 
        if (userWorkingDays.includes(dayName)) {
            workingDays++
        }
    }
    return workingDays
}

async function getUserDailyCapacity(userId, date) {
    const userCapacity = await getUserCapacityData(userId)
    const dayName = getDayName(new Date(date))
    const dateStr = formatDate(new Date(date))

    // Check if it's a working day first
    if (!userCapacity.workingDaysPerWeek.includes(dayName)) {
        return 0;
    }

    // Check for exceptions on this specific date
    const exception = await UserWorkException.findOne({
        userId,
        date: {
            $gte: new Date(dateStr + 'T00:00:00.000Z'),
            $lt: new Date(dateStr + 'T23:59:59.999Z')
        }
    })

    if (exception) {
        return exception.availableHours
    }

    return userCapacity.dailyCapacity
}

async function getExistingAllocationsForDate(userId, date) {
    const dateObj = new Date(date)
    const startOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
    const endOfDay = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999)

    const tasks = await Task.find({
        assignees: userId,
        startDate: { $lte: endOfDay },
        dueDate: { $gte: startOfDay },
        status: { $ne: "Done" }
    })

    let totalAllocated = 0

    for (const task of tasks) {
        const taskStart = new Date(task.startDate)
        const taskEnd = new Date(task.dueDate)
        
        const workingDays = await getWorkingDaysBetween(
            userId,
            taskStart,
            taskEnd
        )

        if (workingDays > 0) {
            const hoursPerUser = task.estimatedHours / task.assignees.length
            const dailyAllocation = hoursPerUser / workingDays
            totalAllocated += dailyAllocation
        }
    }
    return Math.round(totalAllocated * 100) / 100
}

async function getUserAvailableHours(userId, startDate, endDate) {
    const dates = getDateRange(startDate, endDate)
    let totalCapacity = 0
    let totalAllocated = 0
    let totalAvailable = 0
    const dailyBreakdown = []

    for (const date of dates) {
        const dailyCapacity = await getUserDailyCapacity(userId, date)
        const allocatedHours = await getExistingAllocationsForDate(userId, date)
        const availableHours = Math.max(0, dailyCapacity - allocatedHours)
        
        totalCapacity += dailyCapacity
        totalAllocated += allocatedHours
        totalAvailable += availableHours

        dailyBreakdown.push({
            date: formatDate(date),
            dayName: getDayName(date),
            capacity: dailyCapacity,
            allocated: Math.round(allocatedHours * 100) / 100,
            available: Math.round(availableHours * 100) / 100
        })
    }

    return {
        totalCapacity: Math.round(totalCapacity * 100) / 100,
        totalAllocated: Math.round(totalAllocated * 100) / 100,
        totalAvailable: Math.round(totalAvailable * 100) / 100,
        dailyBreakdown,
        utilizationPercentage: totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0
    }
}

async function canUserHandleTask(userId, startDate, endDate, hoursNeeded) {
    try {
        if (!userId || !startDate || !endDate || !hoursNeeded) {
            throw errors.badRequest("Invalid parameters provided for workload check")
        }

        if (hoursNeeded <= 0) {
            throw errors.badRequest("Hours needed must be greater than 0")
        }

        if (new Date(startDate) > new Date(endDate)) {
            throw errors.badRequest("Start date cannot be after end date")
        }

        const availability = await getUserAvailableHours(userId, startDate, endDate)
        const canHandle = availability.totalAvailable >= hoursNeeded
        const surplus = availability.totalAvailable - hoursNeeded

        const newUtilization = availability.totalCapacity > 0 ?
            Math.round(((availability.totalAllocated + hoursNeeded) / availability.totalCapacity) * 100) : 0

        const workingDays = await getWorkingDaysBetween(userId, startDate, endDate)
        const hoursPerDay = workingDays > 0 ? Math.round((hoursNeeded / workingDays) * 100) / 100 : 0

        let suggestedAllocation = null
        if (canHandle && workingDays > 0) {
            suggestedAllocation = {
                totalHours: hoursNeeded,
                workingDays,
                hoursPerDay,
                distribution: generateOptimalDistribution(availability.dailyBreakdown, hoursNeeded)
            }
        }

        return {
            canHandle,
            userId,
            taskPeriod: {
                startDate: formatDate(new Date(startDate)),
                endDate: formatDate(new Date(endDate)),
                workingDays,
            },
            capacity: {
                total: availability.totalCapacity,
                allocated: availability.totalAllocated,
                available: availability.totalAvailable,
                surplus: Math.round(surplus * 100) / 100,
            },
            utilization: {
                current: availability.utilizationPercentage,
                afterAssignment: newUtilization,
                increase: newUtilization - availability.utilizationPercentage
            },
            hoursNeeded,
            suggestedAllocation,
            dailyBreakdown: availability.dailyBreakdown,
            // recommendation: generateRecommendation(canHandle, surplus, newUtilization)
        }
    } catch (error) {
        console.error('Error in canUserHandleTask:', error)
        return {
            canHandle: false,
            error: error.message || "An error occurred while checking workload",
            userId
        }
    }
}

// Fixed optimal distribution function
function generateOptimalDistribution(dailyBreakdown, totalHours) {
    const workingDays = dailyBreakdown.filter(day => day.available > 0)
    if (workingDays.length === 0) {
        return []
    }

    // Sort days by available capacity (descending) to fill high-capacity days first
    workingDays.sort((a, b) => b.available - a.available)
    
    let remainingHours = totalHours
    const distribution = []

    // First pass: distribute evenly
    const baseHoursPerDay = totalHours / workingDays.length

    for (const day of workingDays) {
        const plannedHours = Math.min(
            Math.round(baseHoursPerDay * 100) / 100,
            day.available,
            remainingHours
        )
        
        distribution.push({
            date: day.date,
            dayName: day.dayName,
            plannedHours,
            availableCapacity: day.available
        })
        
        remainingHours -= plannedHours
        remainingHours = Math.round(remainingHours * 100) / 100
    }

    // Second pass: distribute remaining hours to days with capacity
    if (remainingHours > 0) {
        for (const dayDist of distribution) {
            if (remainingHours <= 0) break
            
            const additionalCapacity = dayDist.availableCapacity - dayDist.plannedHours
            const additionalHours = Math.min(additionalCapacity, remainingHours)
            
            dayDist.plannedHours += additionalHours
            dayDist.plannedHours = Math.round(dayDist.plannedHours * 100) / 100
            remainingHours -= additionalHours
            remainingHours = Math.round(remainingHours * 100) / 100
        }
    }

    return distribution.sort((a, b) => new Date(a.date) - new Date(b.date))
}

// Fixed recommendation function
function generateRecommendation(canHandle, surplus, newUtilization) {
    if (!canHandle) {
        return {
            status: 'CANNOT_ASSIGN',
            message: `User cannot handle the task. They have insufficient capacity with ${Math.abs(surplus)} hours shortage.`,
            priority: 'HIGH'
        }
    } 
    
    if (newUtilization >= 90) {
        return {
            status: 'HIGH_UTILIZATION',
            message: `User can handle the task, but their utilization will be high at ${newUtilization}%. Consider redistributing tasks.`,
            priority: 'MEDIUM'
        }
    }
    
    if (surplus < 2) {
        return {
            status: 'LOW_SURPLUS',
            message: `User can handle the task, but they will have only ${Math.abs(surplus)} hours of surplus capacity.`,
            priority: 'LOW'
        }
    }

    return {
        status: 'OPTIMAL',
        message: `User can handle the task with ${Math.abs(surplus)} hours of surplus capacity.`,
        priority: 'LOW'
    }
}

async function canUsersHandleTask(userIds, startDate, endDate, totalHours, distributionStrategy = 'equal') {
    const results = [];
    
    if (distributionStrategy === 'equal') {
        const hoursPerUser = totalHours / userIds.length;
        
        for (const userId of userIds) {
            const result = await canUserHandleTask(userId, startDate, endDate, hoursPerUser);
            results.push(result);
        }
    }
    
    const allCanHandle = results.every(result => result.canHandle);
    const failedUsers = results.filter(result => !result.canHandle);
    
    return {
        canAssignToTeam: allCanHandle,
        individualResults: results,
        failedUsers,
        totalHours,
        distributionStrategy,
        summary: {
            usersCount: userIds.length,
            successCount: results.filter(r => r.canHandle).length,
            failureCount: failedUsers.length
        }
    };
}

function clearUserCapacityCache(userId = null) {
    if (userId) {
        userCapacityCache.delete(userId.toString());
    } else {
        userCapacityCache.clear();
    }
}

export {
    canUserHandleTask,
    canUsersHandleTask,
    getUserAvailableHours,
    getWorkingDaysBetween,
    getUserDailyCapacity,
    getExistingAllocationsForDate,
    getDateRange,
    getDayName,
    formatDate,
    clearUserCapacityCache,
};