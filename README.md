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
```

```uname``` and ```pwd``` are your respective MongoDB database access credentials.

```ACCESS_KEY``` and ```SECRET_ACCESS_KEY``` are the respective credentials of the concerned IAM user.

```SPACE_NAME``` is the name of the storage bucket to which files will be saved to.

then run 

```npm run dev```

if you have an issue with port 3001
change the port in the ```.env``` file
