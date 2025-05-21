const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const app = express()
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const passportPostRoutes = require('./routes/passportRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const userDashboardRoutes = require('./routes/userDashboardRoutes');


const cors = require('cors')




app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))




// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use('/api/passport-posts', passportPostRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/user-dashboard', userDashboardRoutes); 


app.get('/', (req, res) => {
    res.send("Hello World");
})


module.exports = app;