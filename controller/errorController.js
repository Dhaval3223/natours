// const mongoose = require('mongoose');
const AppError = require('../utils/appError');

const handleCastErrorDB = err => {
    const message = `Invalid ${err.path}: ${err.value}.`;
    return new AppError(message, 400);
}

const handleDuplicateFieldDB = err => {
    const message = `Duplicate field value: ${err.keyValue.name}. Please use anothername`;
    return new AppError(message, 400);
}
const handleValidationErrorDB = err => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invallid InputData.${errors.join('. ')}`;
    return new AppError(message, 400);
}

const handleJWTError = () => new AppError('invalid token please login again!', 401);
const handleEXPError = () => new AppError('invalid token please login again!', 401);

const sendErrorDev = (err, req, res) => {
    // API
    if (req.originalUrl.startsWith('/api')) {
        return res.status(err.statusCode).json({
            status: err.status,
            error: err,
            message: err.message,
            stack: err.stack
        });
    } 
    //  RENDERED WEBSITE
    console.error('Error 💥', err);

    return res.status(err.statusCode).render('error', {
        title: 'Something went wrong!',
        msg: err.message
    });
};

const sendErrorProd = (err, req, res) => {
    // API
    if (req.originalUrl.startsWith('/api')) {
        // Operational Trusted error: send msg to client
        if(err.isOperational){
            return res.status(err.statusCode).json({
                status: err.status,
                message: err.message,
            });
        }
            // 1)Log Error
            console.error('Error 💥', err);
    
            // 2)send generic msg
            return res.status(500).json({
                status: 'Error',
                message: 'something went wrong'
            });
    }
    // RENDERING website
    if(err.isOperational){
        return res.status(err.statusCode).render('error', {
            title: 'Something went wrong!',
            msg: err.message
        })
    } 
        // 1)Log Error
        console.error('Error 💥', err);

        // 2)send generic msg
        return res.status(err.statusCode).render('error', {
            title: 'Something went wrong!',
            msg: 'Please try again later'
        });
};

module.exports = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    if (process.env.NODE_ENV === 'development') {
        sendErrorDev(err, req, res);
    } else if (process.env.NODE_ENV === 'production') {
        let error = Object.assign(err);
        // error.message = err.message;

        if (error.name === 'CastError') error = handleCastErrorDB(error);
        if (error.code === 11000) error = handleDuplicateFieldDB(error);
        if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
        if (error.name === 'JsonWebTokenError') error = handleJWTError();
        if (error.name === 'TokenExpiredError') error = handleEXPError();


        sendErrorProd(error, req, res);
    }
};

// err instanceof mongoose.Error.CastError