const mongoose = require('mongoose');

const passportSchema = new mongoose.Schema({
  passports: [{
    passportNumber: {
      type: String,
      required: [true, 'Passport number is required'],
      trim: true,
    //   minlength: [5, 'Passport number must be at least 5 characters'],
    //   maxlength: [20, 'Passport number cannot exceed 20 characters']
    },
    link: {
      type: String,
      required: [true, 'Link is required'],
      match: [
        /^(http|https):\/\/[^ "]+$/,
        'Please provide a valid URL'
      ]
    },
    city: {
      type: String,
      trim: true
    },
    slipNo: {
      type: String,
      trim: true
    },
    issuedCountry: {
      type: String,
      required: [true, 'Issued country is required'],
      trim: true,
      minlength: [2, 'Country name must be at least 2 characters'],
      maxlength: [50, 'Country name cannot exceed 50 characters']
    },
    postDate: {
      type: Date,
      default: Date.now
    },
    otherDetails: {
      type: String,
      trim: true
    }
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Static method to get all passports
passportSchema.statics.getAllPassports = async function() {
  return this.find({ isActive: true })
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email')
    .sort({ createdAt: -1 });
};

// Static method to delete a single passport by ID
passportSchema.statics.deleteSinglePassport = async function(passportId, userId) {
  // Find the post that contains the passport
  const post = await this.findOne({
    'passports._id': passportId
  });

  if (!post) {
    return null;
  }

  // Get the passport to log before deletion
  const passportToRemove = post.passports.find(
    passport => passport._id.toString() === passportId
  );

  // If post only has one passport, delete the entire post
  if (post.passports.length === 1) {
    await post.deleteOne();
    return [passportToRemove];
  }

  // Otherwise, remove just the specific passport
  post.passports = post.passports.filter(
    passport => passport._id.toString() !== passportId
  );
  
  // Update the updatedBy field
  post.updatedBy = userId;
  
  await post.save();
  
  return [passportToRemove];
};

// Static method to delete multiple passports by IDs
passportSchema.statics.deleteMultiplePassports = async function(passportIds, userId) {
  if (!Array.isArray(passportIds) || passportIds.length === 0) {
    return [];
  }

  const deletedPassports = [];

  // Process each passport ID
  for (const passportId of passportIds) {
    // Find the post containing this passport
    const post = await this.findOne({
      'passports._id': passportId
    });

    if (!post) continue;

    // Get the passport to log before deletion
    const passportToRemove = post.passports.find(
      passport => passport._id.toString() === passportId
    );
    
    if (passportToRemove) {
      deletedPassports.push(passportToRemove);
    }

    // If post only has one passport, delete the entire post
    if (post.passports.length === 1) {
      await post.deleteOne();
    } else {
      // Otherwise, remove just the specific passport
      post.passports = post.passports.filter(
        passport => passport._id.toString() !== passportId
      );
      
      // Update the updatedBy field
      post.updatedBy = userId;
      
      await post.save();
    }
  }
  
  return deletedPassports;
};

const PassportPost = mongoose.model('PassportPost', passportSchema);

module.exports = PassportPost;