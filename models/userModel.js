const crypto = require('crypto');
const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcryptjs');

//name, email, photo, password, passwordconfirm
const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required: [true, 'Please enter your name']
    },
    email:{ 
        type: String,
        required: [true, 'Email Required'],
        unique: true,
        lowercase: true,
        validate: [validator.isEmail, 'Please provide valid email.']
    },
    photo: {
        type: String,
        default: "default.jpg"
    },
    role: {
        type: String,
        enum: ['user', 'guide', 'lead-guide', 'admin'],
        default: 'user'
    },
    password: {
        type: String,
        required: [true, 'Please provide password'],
        minlength:8,
        select: false
    },
    passwordConfirm: {
        type: String,
        required: [true, 'Please confirm password'],
        validate: {
            // this will work only on create nd save
            validator: function(el) {
                return el === this.password;
            },
            message: 'passwords and confirmPasswords are not same'
        }
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
        type: Boolean,
        default: true,
        select: false
    }
});

userSchema.pre('save', async function(next){
    // we want only run this code if password was actually modified
    if(!this.isModified('password')) return next();

    // hashing pass
    this.password = await bcrypt.hash(this.password, 12);

    // delete the passwordconfirm field
    this.passwordConfirm =  undefined;
    next();
});

userSchema.pre('save', function(next) {
    if (!this.isModified('password') || this.isNew) return next();

    this.passwordChangedAt = Date.now() - 1000;/** here -1000 is small hack to delay 1sec */
    next();
});

userSchema.pre(/^find/, function(next){
    // this points to current query
    this.find({ active: {$ne: false} });
    next();
});

userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
    return await bcrypt.compare(candidatePassword, userPassword);
}; 

userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
    if (this.passwordChangedAt) {
        const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
        return JWTTimestamp < changedTimestamp;
    }

    // false means not changed
    return false;
};

userSchema.methods.createPasswordResetToken = function() {
    const resetToken = crypto.randomBytes(32).toString('hex');

    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    console.log({resetToken}, this.passwordResetToken);

    this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

    return resetToken;
};

const User = mongoose.model('User',  userSchema);

module.exports = User;