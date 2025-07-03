This is the backend for the project management software built during my internship at DaacoWorks.

Contents:

## Contents

- [Setup](#setup)
- [Running the backend](#running-the-backend)
- [Rate Limiting](#rate-limiting)
- [Nodemailer](#nodemailer)
- [Redis](#redis)
- [Bull MQ](#bull-mq)
- [Role Based Access Control](#role-based-access-control)
- [Skill Matrix](#skill-matrix)
- [S3 Setup](#s3-setup-digitalocean-spaces)
- [File Uploads](#file-uploads-multer-middleware)
- [Workload Allocation and Calculation](#workload-allocation-and-calculation)



### Setup
To copy the project in your local computer please make sure that you have git setup and use the command

```git clone https://github.com/Lonewolf230/project-management.git```

then run 
```npm install```
in the project folder to download dependencies.



create a file called ```.env```
with the following content

```
MONGODB_URI=mongodb+srv://<uname>:<pwd>@cluster0.f9ys2fz.mongodb.net/dev2?retryWrites=true&w=majority&appName=Cluster0
PROD_MONGODB_URI=mongodb+srv://<uname>:<pwd>@cluster0.f9ys2fz.mongodb.net/prod?retryWrites=true&w=majority&appName=Cluster0
TEST_MONGODB_URI=mongodb+srv://<uname>:<pwd>@cluster0.f9ys2fz.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0
PORT=3001
ACCESS_KEY=
SECRET_ACCESS_KEY=
REGION=
SPACE_NAME=


EMAIL_ID=
PASSWORD=

JWT_SECRET=

REDIS_PASSWORD=
REDIS_USERNAME=
REDIS_PORT=
REDIS_HOST=

CLIENT_URL=
```

```uname``` and ```pwd``` are your respective MongoDB database access credentials.

```ACCESS_KEY``` and ```SECRET_ACCESS_KEY``` are the respective credentials of the concerned IAM user.

```SPACE_NAME``` is the name of the storage bucket to which files will be saved to.

```EMAIL_ID``` and ```PASSWORD``` are the email-id and password for the nodemailer configuration. 

all vars starting with REDIS are obtained from Redis-cloud for connecting to redis.

```JWT_SECRET``` is the secret variable used to sign tokens for JWT AUTH.

### Running-the-backend

then run 

```npm run dev``` this is for development env.
```npm run start`` for prod env
```npm run test``` for test env.

if you have an issue with port 3001
change the port in the ```.env``` file

### Rate Limiting

Rate limiting is implemented using `express-rate-limit` to protect the API from abuse and brute-force attacks.

#### Global Rate Limiter

- Applies to all routes
- Limits: 200 requests per 15 minutes per IP
- Response when exceeded:
```json
  {
    "status": "fail",
    "message": "Too many requests from this IP, please try again after 15 minutes"
  }
```

#### Auth Rate Limiter

- Applies to only login route
- Limits: 5 requests per 5 minutes to prevent excessive login attempts



### Nodemailer 

Nodemailer is necessary for sending mails to users.
In this setup I have created a new email solely for the purpose of sending invite mails on behalf of the app.

```js
const transporter=nodemailer.createTransport({
    service:'gmail',
    auth:{
        user:process.env.EMAIL_ID,
        pass:process.env.PASSWORD
    }
})
```

This service is configured for GMail so 
1. Create a new GMail account or use an existing one
2. Set up 2-Factor Authentication
3. Once done go to App Passwords section
4. Name your app and get a 16-character password. This will be shown only once so copy it to some place safe.

In the [Setup](#setup) `.env` file `EMAIL_ID` is this newly created E-mail ID and `PASSWORD` is the generated 16-character password.

### Redis

We use Redis as a cache store and background job store here.
When a user logs-out their cookie is cleared from browser but the token cannot be invalidated so we use redis and set a key with the ```token``` as the key and value as ```blacklisted``` with a ttl.

This needs usage of ```setEx``` command.


Here is the Redis Setup:

```js
const client = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT ,
    }
});

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

```

### Bull MQ

Bull MQ is our queue system which helps us use our redis database as a store for jobs.

In our backend we use job queues to send defualt E-mail and password for newly registered users via nodemailer in the background.

We also use queues for handling instant deletions for our multi-wizard project and task creation process.

We should set up queues with appropriate settings like this.

```js
const redisConnection={
    host:process.env.REDIS_HOST,
    port:Number(process.env.REDIS_PORT),
    username:process.env.REDIS_USERNAME,
    password:process.env.REDIS_PASSWORD
}

export const emailQueue=new Queue('email-queue',{
    connection:redisConnection,
    defaultJobOptions:{
        removeOnComplete:true,
        removeOnFail:10,
        attempts:3,
        backoff:{
            type:'exponential',
            delay:2000
        },
    }
})
```

The ```redisConnection``` object contains the same ```.env``` vars we used for the Redis config.

So here we have successfully created a queue called ```email-queue```

So basically in our endpoints we can offload heavy tasks or time consuming tasks as background processes significantly speeding up response times.

In our api endpoints we just do this

```js
  await emailQueue.add("send-email",{
    toEmail: email,
    toName: name,
    role:role || 'user',
    password,
    username: email
  })
```
```send-email``` is the name of the job and we also pass the payload as an object.

To process this job we need a worker which reads from the queue and processes jobs in the background.

```js
const worker= new Worker('email-queue',async(job)=>{
    const {toEmail,toName,role,password,username}=job.data;
    console.log(`Processing email for ${toName} (${toEmail}) with role ${role} and job id ${job.id}`);
    try{
        await sendUserEmail(toEmail,toName,role,password,username);
        await job.updateProgress(100);
        console.log(`Email sent successfully to ${toName} (${toEmail})`);
        return {status:'success',message:`Email sent to ${toName} (${toEmail})`};
    }
    catch(err){
        console.error(`Error sending email to ${toName} (${toEmail}):`, err);
        await job.updateProgress(0);
        throw new Error(`Failed to send email to ${toName} (${toEmail}): ${err.message}`);
    }    
},{connection:redisConnection})

worker.on('completed',(job)=>{
    console.log(`Job ${job.id} completed successfully`);
})

worker.on('failed',(job,err)=>{
    console.error(`Job ${job.id} failed with error:`, err);
})
```

the worker needs a ```redisConnection``` object and we can also setup various listeners for different states like ```completed``` and ```failed``` etc.


### Role-Based Access Control

There are 4 roles in the backend.

```super-admin``` -> unrestricted access can literally do anything.
```admin```       -> can do anything except create other admins or super-admins.
```user```        -> limited view/edit privileges and depends on whether user is a project manager or a mere team member.
```client```      -> view only access in projects in which they are a part of.

Various helper functions are used to check the role and enforce privileges during runtime.

The utilities can be found in ```/utils/validationUtils.js```


### Skill Matrix

The Skill Matrix module is used to track and evaluate user proficiency across various skills. Each skill is categorized as either *Technical* or *Non-Technical*, and users can rate their proficiency on a scale from 1 to 5.

#### Skill Schema

Each skill contains the following fields:

- `name`: A unique, alphabetic name for the skill (e.g., "React", "Leadership")
- `category`: Must be one of `Technical` or `Non-Technical`

#### User Skill Ratings

Users rate themselves on each skill using a numeric scale:

- `1` – No knowledge  
- `2` – Beginner  
- `3` – Intermediate  
- `4` – Advanced  
- `5` – Expert

Example user rating data:

```json
{
  "userId": "64d1f9b12abcde1234567890",
  "skills": [
    { "skillId": "64d1f9b12abcde1234567001", "rating": 4 },
    { "skillId": "64d1f9b12abcde1234567002", "rating": 2 }
  ]
}
```

### S3 Setup (DigitalOcean Spaces)

This project uses DigitalOcean Spaces (S3-compatible object storage) for file uploads via the AWS SDK.

#### Configuration

The `S3Client` is initialized using the `@aws-sdk/client-s3` package with the following options:

- `region`: Your DO space region (e.g., `blr1`)
- `endpoint`: Constructed as `https://${REGION}.digitaloceanspaces.com`
- `credentials`: Access and secret keys from your DO project
- `forcePathStyle`: Set to `false` (required for DO Spaces)

Environment variables used:

REGION=your_region
ACCESS_KEY=your_access_key
SECRET_ACCESS_KEY=your_secret_key


The utility functions for uploads,deletion and getting presigned URLs are included in the ```s3Utils.js``` file

### File Uploads (Multer Middleware)

Multer is used to handle multipart form uploads and validate files before sending them to S3 (DigitalOcean Spaces).

#### Configuration

- **Storage**: In-memory (`multer.memoryStorage()`)
- **Max File Size**: 10MB per file
- **Max Files**: 5
- **Accepted MIME Types**:
  - `image/jpeg`, `image/png`
  - `application/pdf`
  - `application/msword` (.doc)
  - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx)

#### Error Handling

If the file violates size, count, or type limits, Multer will reject the request with structured error messages.

#### Example Usage

```js
import uploadMiddleware from './middlewares/upload.js';

app.post('/upload', uploadMiddleware, async (req, res) => {
  const files = req.files; // Access uploaded files here
  // Proceed with uploading to S3
});
```


### Workload Allocation and Calculation

This module provides dynamic workload analysis and allocation for team members when assigning project tasks. It evaluates each user's availability based on their configured capacity and any exceptions (like holidays or sick leaves), ensuring fair and realistic workload distribution.

#### Features

- Analyze workload at the individual or team level.
- Smartly allocate task hours using:
  - `UserCapacity`: user-specific daily and weekly availability
  - `UserWorkException`: time-off or capacity-reducing exceptions
- Supports:
  - `individual` mode: evaluate each user separately
  - `team` mode: evaluate group capacity collectively
- Distribute hours using configurable strategies (e.g., equal distribution)
- Return detailed utilization and assignment breakdown per user

---

#### Route: `GET /searchTeamMembers`

##### Query Parameters

| Parameter              | Type     | Description |
|------------------------|----------|-------------|
| `projectId`            | string   | Project ID for team filtering |
| `query`                | string   | Text search (name or email) |
| `skills`               | array    | Skill IDs to filter users |
| `limit`                | number   | Max number of users to return (default: 15) |
| `requiredHours`        | number   | Total task hours to allocate |
| `taskStartDate`        | string   | Start date of the task |
| `taskEndDate`          | string   | End date of the task |
| `selectedUserIds`      | array    | List of user IDs currently selected |
| `includeWorkload`      | boolean  | If true, performs workload calculation |
| `calculationMode`      | string   | `individual` or `team` (defaults to individual) |
| `distributionStrategy` | string   | Strategy to distribute hours (e.g., `equal`) |

---

#### How It Works

##### Capacity Sources

- **UserCapacity**
  - `dailyCapacity`: Maximum number of hours user can work per day (default: 8)
  - `weeklyCapacity`: Maximum number of hours user can work per week (default: 40)
  - `workingDaysPerWeek`: Days available for work (defaults to Mon–Fri)

- **UserWorkException**
  - Captures holidays, sick leaves, vacations, etc.
  - Reduces availability during task period

##### Calculation Modes

1. **Individual Mode**
   - Checks each user independently
   - Distributes `requiredHours / totalUsers` per user
   - Returns utilization, available hours, surplus/shortfall, and task feasibility

2. **Team Mode**
   - Distributes workload across selected users
   - Validates if total team capacity covers task hours
   - Returns team summary and per-user breakdown

---

#### Example Response

```json
{
  "status": "success",
  "count": 3,
  "teamMembers": [
    {
      "id": "userId1",
      "name": "Alice",
      "email": "alice@example.com",
      "role": "Developer",
      "isSelected": true,
      "workloadInfo": {
        "canHandle": true,
        "hoursAssigned": 12,
        "currentUtilization": "40%",
        "projectedUtilization": "70%",
        "utilizationIncrease": "30%",
        "availableCapacity": "20 hours",
        "totalCapacity": "40 hours",
        "surplus": "8 hours",
        "workingDays": 4,
        "hoursPerDay": "3 hours"
      }
    }
  ],
  "teamAnalysis": {
    "canAssignToTeam": true,
    "totalHours": 24,
    "distributionStrategy": "equal",
    "individualResults": [...],
    "summary": "...",
    "teamCapacity": {
      "totalCapacity": 80,
      "totalAllocated": 56,
      "totalAvailable": 24
    }
  },
  "mode": "team"
}
```

---

#### Benefits

- Prevents over-allocation of users
- Accounts for real-time availability and exceptions
- Helps project managers assign tasks based on actual working capacity
- Improves transparency and workload fairness





