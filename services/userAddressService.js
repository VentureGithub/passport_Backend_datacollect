const userAddressModel = require('../models/userAddress')

const createUserAddress = async({
    userId,
    state,
    city,
    location,
    mobileNo,
    pinCode
}) => {
    if(!userId || !state || !city || !location || !mobileNo || !pinCode)
    {
        throw new Error("All fields are required")
    }
    const userAddress = await userAddressModel.create({
        userId,
        state,
        city,
        location,
        mobileNo,
        pinCode
    })
    return userAddress
}

module.exports = {createUserAddress}