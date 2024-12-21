const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const cookie = require('cookie-parser')
const app = express()
require('dotenv').config()

const port = process.env.PORT || 5000;
const {
  MongoClient,
  ServerApiVersion,
  ObjectId
} = require('mongodb');


app.use(cors({
  origin: ['http://localhost:5173',
    'https://job-portal-client-80b60.web.app',
    'https://job-portal-client-80b60.firebaseapp.com'
  ],
  credentials: true
}));
app.use(express.json());
app.use(cookie())

const verifyToken = (req, res, next) => {
  console.log('Inside the verify token')
  const token = req?.cookies?.token;
  // console.log(token)
  if (!token){
    return res.status(401).send({message: 'Unauthorized access'})
  }

   jwt.verify(token,process.env.JWT_SecretKey, (err, decoded)=>{
    if(err){
      return res.status(401).send({message: 'Unauthorized Access'})
    }
    // 
    req.user = decoded
    next()
   })

   
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bho7r.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({
    //   ping: 1
    // });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    //   Job Related API's

    const jobsCollection = client.db('JobPortal').collection('jobs');
    const jobApplicationCollection = client.db('JobPortal').collection('job-applications')



    // Auth Related API's
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SecretKey, {
        expiresIn: '1h'
      });
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",

        })
        .send({
          success: true
        })
    })

    app.post('/logout', (req,res)=>{
      res.clearCookie('token',{
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      }).send({
        success: true
      })
    })

    app.get('/jobs', async (req, res) => {
      const email = req.query.email;
      let query = {}
      if (email) {
        query = {
          hr_email: email
        }
      }
      const cursor = jobsCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })
    app.get('/jobs/:id', async (req, res) => {
      const id = req.params.id;
      const query = {
        _id: new ObjectId(id)
      }
      const result = await jobsCollection.findOne(query)
      res.send(result)
    })
    app.post('/jobs', async (req, res) => {

      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob)


      res.send(result)
    })

    // Job Application API's

    app.post('/job-application', async (req, res) => {
      const application = req.body;
      const result = jobApplicationCollection.insertOne(application);

      const id = application.job_id;
      const query = {
        _id: new ObjectId(id)
      }
      const job = await jobsCollection.findOne(query)
      // console.log(job)

      let newCount = 0;
      if (job.applicationCount) {
        newCount = job.applicationCount + 1;
      } else {
        newCount = 1
      }

      // Now update the job info
      const filter = {
        _id: new ObjectId(id)
      }
      const updatedDoc = {
        $set: {
          applicationCount: newCount
        }
      }
      const updateResult = await jobsCollection.updateOne(filter, updatedDoc)

      res.send(result)
    })

    app.get('/job-application', verifyToken, async (req, res) => {
      const email = req.query.email;
      const query = {
        applicant_email: email
      }

      // req.user = decoded
      if(req.user.email !== email){
        return res.status(403).send({message: 'forbidden access'})
      }

      const cursor = jobApplicationCollection.find(query)
      const result = await cursor.toArray()

      for (const application of result) {
        // console.log(application.job_id)
        const query_1 = {
          _id: new ObjectId(application.job_id)
        }
        const job = await jobsCollection.findOne(query_1)

        if (job) {
          application.title = job.title;
          application.company = job.company;
          application.company_logo = job.company_logo;
          application.location = job.location;
          application.category = job.category
        }
      }
      res.send(result)
    })

    app.delete('/job-application/:id', async (req, res) => {
      const id = req.params.id;
      const email = req.query.email;
      const query = {
        _id: new ObjectId(id),
        applicant_email: email
      };

      try {
        const result = await jobApplicationCollection.deleteOne(query);
        if (result.deletedCount === 1) {
          res.status(200).send({
            message: "Job application deleted successfully"
          });
        } else {
          res.status(404).send({
            error: "No job application found with the given ID"
          });
        }
      } catch (error) {
        res.status(500).send({
          error: "Failed to delete job application"
        });
      }
    });

  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.log);

app.get('/', (req, res) => {
  res.send('Job is falling from the sky')
})

app.listen(port, () => {
  console.log(`The port is running on PORT: ${port}`)
})