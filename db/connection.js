const mongoose = require('mongoose');

const connection = () => {
    const mongoURI = process.env.MONGO_URL;

    if (!mongoURI) {
        console.error("MONGO_URI not set in environment variables");
        return;
    }

    mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log("Database Connected Successfully"))
    .catch((err) => console.log("Database connection error:", err));
};

module.exports = connection;