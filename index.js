const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;

// const corsOptions ={
//     origin:'*',
//     credentials:true,
//     optionSuccessStatus:200,
// }
// app.use(cors(corsOptions))
app.use(cors({
    origin: [
        // 'http://localhost:5173',
        'https://online-group-study-app.web.app',
        'https://online-group-study-app.firebaseapp.com'
    ],
    // origin: '*',
    // origin: 'https://online-group-study-app.web.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(cookieParser());

// const uri = `mongodb+srv://rafikk1998:bqrXTIYWwPDsjeUM@cluster0.gf4ueyo.mongodb.net/?retryWrites=true&w=majority`;
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_CLUSTER}/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

// middlewares
const logger = (req, res, next) => {
    console.log('log info: ', req.method, req.url);
    next();
}


const verifyToken = (req, res, next) => {
    const token = req?.cookies?.token;
    console.log('token in middleware: ', token );
    // no token available
    if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err) {
            return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded;
        next();
    })

    // next();
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        const onlineGroupStudyDB = client.db('onlineGroupStudyDB');

        const assignmentsCollection = onlineGroupStudyDB.collection('assignmentsCollection');
        const submittedAssignmentsCollection = onlineGroupStudyDB.collection('submittedAssignmentsCollection');
        

        // Auth related API
        app.post('/jwt', logger, async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1hr' })
            
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
                sameSite: 'none',
                maxAge: 60 * 60 * 1000
            })
            .send({ success: true })
        })

        app.post('/logout', async (req, res) => {
            const user = req.body;
            res.clearCookie('token', { maxAge: 0}).send({ success: true });
        })

        // Assignments APIs
        app.get('/assignments', async (req, res) => {
            const cursor = assignmentsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        // app.get('/assignments', async (req, res) => {
        //     console.log(req.query.email);
        //     console.log(req.user);
        //     if (req.user.email !== req.query.email) {
        //         return res.status(403).send({ message: 'forbidden access' });
        //     }
        //     let query = {};
        //     if (req.query?.email) {
        //         query = { email: req.query.email }
        //     }
        //     const result = await assignmentsCollection.find(query).toArray();
        //     // const result = await cursor.toArray();
        //     res.send(result);
        // });
        app.get('/assignments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const result = await assignmentsCollection.findOne(query);
            res.send(result);
        });
        app.get('/my-assignments', logger, verifyToken, async (req, res) => {
            console.log(req.query.email);
            console.log(req.user);
            if (req.user.email !== req.query.email) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            let query = {};
            if (req.query?.email) {
                query = { submittedBy: req.query.email }
            }
            const result = await submittedAssignmentsCollection.find(query).toArray();
            // const result = await cursor.toArray();
            res.send(result);
        });

        app.post('/assignments', async (req, res)=> {
            const newAssignment = req.body;
            console.log(newAssignment);
            const result = await assignmentsCollection.insertOne(newAssignment);
            res.send(result);
        });
        app.patch('/assignments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id)};
            const options = { upsert: true };
            const updatedAssignment = req.body;
            const updateDoc = {
                $set: {
                    title: updatedAssignment.title,
                    description: updatedAssignment.description,
                    marks: updatedAssignment.marks,
                    photoUrl: updatedAssignment.photoUrl,
                    difficulty: updatedAssignment.difficulty,
                    dueDate: updatedAssignment.dueDate,
                },
            };
            const result = await assignmentsCollection.updateOne(query, updateDoc, options);
            res.send(result);
        })
        app.delete('/assignments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await assignmentsCollection.deleteOne(query);
            res.send(result);
        })
        // app.patch('/assignments/:id', async (req, res)=> {
        //     const id = req.params.id;
        //     const query = { _id: new ObjectId(id)};
        //     const updatedAssignment = req.body;
        //     const updateDoc = {
        //         $set: {
        //             status: updatedAssignment.status
        //         },
        //     };
        //     const result = await assignmentsCollection.insertOne(newAssignment);
        //     res.send(result);
        // });

        app.get('/assignmentsCount', async (req, res) => {
            const estimatedCount = await assignmentsCollection.estimatedDocumentCount();
            res.send({estimatedCount});
        });

        // Submitted Assignments API
        app.get('/submittedAssignments', async (req, res) => {
            const cursor = submittedAssignmentsCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });
        app.post('/submittedAssignments', async (req, res) => {
            const newSubmission = req.body;
            console.log(newSubmission);
            const result = await submittedAssignmentsCollection.insertOne(newSubmission);
            res.send(result);
        });
        app.patch('/submittedAssignments/:submissionId', async (req, res) => {
            const submissionId = req.params.submissionId;
            const query = { _id: new ObjectId(submissionId)};
            console.log(submissionId);
            console.log(query._id);
            const updatedSubmission = req.body;
            console.log(updatedSubmission);
            const updatedDoc = {
                $set: {
                    status: updatedSubmission.status,
                    score: updatedSubmission.score,
                    feedback: updatedSubmission.feedback,
                },
            }
            const result = await submittedAssignmentsCollection.updateOne(query, updatedDoc);
            res.send(result);
        });

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get("/", (req, res) => {
    res.send({ status: 200, message: 'All okay and Server running!'})
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});