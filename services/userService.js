const userModel = require('../models/userModel');

const createUser = async ({ fullName, email, password,role }) => {
    if (!fullName || !email || !password || !role) {
        throw new Error("Please fill all the fields");
    }

    const user = await userModel.create({
        fullName,
        email,
        password,
        role
    });

    return user;  // Return the created user object
};



module.exports = { createUser };
