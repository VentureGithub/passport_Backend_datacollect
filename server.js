const http = require('http');
const express = require('express');
const cors = require('cors');  
const socketIo = require('socket.io');
const connectDb = require('./db/connection');
const app = require('./app');
const errorHandler = require('./errorHandler');
const port = process.env.PORT || 4000;

// Apply CORS middleware to Express BEFORE routes
app.use(cors());  

const server = http.createServer(app);

const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    }
});

// Socket.io connection setup
io.on('connection', (socket) => {
    console.log("Client connected");

    socket.on('disconnect', () => console.log('Client disconnected'));
});

// API Routes
app.post('/send', (req, res) => {
    const { message } = req.body;
    const payload = { message, time: new Date().toLocaleTimeString() };
    io.emit('notification', payload);
    return res.status(200).json({ message: "Sent successfully" });
});

app.post('/send/request', (req, res) => {
    const { message } = req.body;
    const payload = { message, time: new Date().toLocaleTimeString() };
    io.emit('notification', payload);
    return res.status(200).json({ message: "Sent successfully" });
});

// Connect to DB
connectDb();

// Start the server
server.listen(port, () => {
    console.log("Server is listening at port " + port);
});

process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Close server & exit process
    server.close(() => process.exit(1));
});