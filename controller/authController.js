const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError'); 
const  Email = require('../utils/email');
// const { findById } = require('../models/userModel');

const signToken = id => {
    return jwt.sign( { id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN
    });
}

const createSendToken = (user, statusCode, res) => {
    const token = signToken(user._id);

    const cookieOptions = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000),
        httpOnly: true
    };
    if(process.env.NODE_env === 'production') cookieOptions.secure = true

    res.cookie('jwt', token, cookieOptions);

    user.password = undefined;

    res.status(statusCode).json({
        status: 'success',
        token,
        data: {
            user
        }
    });
}

exports.signup = catchAsync(async (req, res, next) => {
    const newUser = await User.create({
        name: req.body.name,
        email: req.body.email,
        role: req.body.role,
        password: req.body.password,
        passwordConfirm: req.body.passwordConfirm,
        passwordChangedAt: req.body.passwordChangedAt
    });

    const url = `${req.protocol}://${req.get('host')}/me`;
    console.log(url);
    await new Email(newUser, url).sendWelcome();

    createSendToken(newUser, 201, res);
});

exports.login = async (req, res, next) => {
    const { email, password } = req.body;

    // 1)check if email and password exist
    if ( !email || !password) {
        return next(new AppError('please provide email and password', 401));
    }

    // 2)check if user exist and password correct
    const user = await User.findOne({ email }).select('+password');
    console.log(user);

    if (!user || !(await user.correctPassword(password, user.password))) {
        return next(new AppError('invalid email or password', 401));
    }

    // 3)if anything ok,send token to client
    createSendToken(user, 200, res);
}

exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true
    });
    res.status(200).json({ status: 'success' });
  };

exports.protect = catchAsync(async (req, res, next) => {
    // 1)get token and check if exist
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.jwt) {
        token = req.cookies.jwt;
    }
    // console.log(token); 

    if  (!token) {
        return next(new AppError('You are not loggedIn! Please login to get access.', 401));
    }

    // 2)varification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    console.log(decoded);

    // 3)chek if user still exist or not
    const currentUser = await User.findById(decoded.id);
    if  (!currentUser) {
        return next(new AppError('user belongs to this token no longer exist.', 401));
    }

    // 4)chek if user heanged password fter the token was issued
    if ( currentUser.changedPasswordAfter(decoded.iat) ) {
        next(new AppError('this user has currently changed password. please login again.'), 401);
    };

    // GRANT ACCSS TO PROTECTED ROUTE
    req.user = currentUser;
    res.locals.user = currentUser;
    next();
});

// Only for randored pages, no errors!
exports.isLoggedIn = async (req, res, next) => {
    if (req.cookies.jwt) {
        try {
    // 1)varification of token
    const decoded = await promisify(jwt.verify)(
        req.cookies.jwt, 
        process.env.JWT_SECRET);

    // 2)chek if user still exist or not
    const currentUser = await User.findById(decoded.id);
    if  (!currentUser) {
        return next();
    }

    // 3)chek if user heanged password fter the token was issued
    if ( currentUser.changedPasswordAfter(decoded.iat) ) {
        return next();
    };

    // THERE IS A LOGGED IN USER
    res.locals.user = currentUser;
    return next();
} catch(err) {
    return next();
}
}
next();
};

exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        // roles [admin, lead-guide]
        if (!roles.includes(req.user.role) ) {
            return next(new AppError('you do not have to permission to perform this action', 403));
        };
        next();
    }
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
    //1) get user based on POSTed email
    const user = await User.findOne( {email: req.body.email} );
    if (!user) {
        return next(new AppError('There is no user with this email address.', 404));
    }

    //2) generate the random token
    const resetToken = user.createPasswordResetToken();
    await user.save({ validateBeforeSave: false });

    //3) send it to user's email
    
    
    try {
        const resetURL = `${req.protocol}://${req.get('host')}/api/v1/resetPassword/${resetToken}`;
        // await sendEmail({
        //     email: user.email,
        //     subject: 'Your Password is valid for 10 minits',
        //     message
        // });
        await new Email(user, resetURL).sendPasswordReset();
    
        res.status(200).json({
            status: 'status',
            message: 'token sent to email.'
        });
    } catch(err) {
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save({ validateBeforeSave: false });

        return next(new AppError('there is an error to sending the email', 500));
    }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
    // 1)Get User Based on token
    const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

    const user = await User.findOne({
        passwordResetToken: hashedToken,
        passwordResetExpires: { $gt: Date.now() }
    });

    // 2)if token has not expired, and their is user, set newpassword
    if (!user) {
        return next(new AppError('Token is invalid or expired', 400));
    }
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // 3)Update changedPasswordAt property for the user(pre save middleware at user model)
    // 4)logged the user in, send JWT 
    createSendToken(user, 200, res);
});

exports.updatePassword =catchAsync(async (req, res, next) => {
    // 1)get the user from the collection
    const user = await User.findById(req.user.id).select('+password');

    // 2)chek if POSTed currrent password is correct or not
    if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
        return next(new AppError('your current password is wrong', 401));
    }
    
    // 3)if so update the password
    user.password = req.body.password;
    user.passwordConfirm = req.body.passwordConfirm;
    await user.save();

    // 4)log user in, send JWT
    createSendToken(user, 200, res);
});