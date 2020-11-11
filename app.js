const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSenitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globaleErrorHandler = require('./controller/errorController');
const tourRouter = require('./routes/tourRoutes');
const userRouter = require('./routes/userRoutes');
const reivewRouter = require('./routes/reviewRoutes');
const bookingRouter = require('./routes/bookingRoutes');
const viewRouter = require('./routes/viewRoutes');

const app = express(); 

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// 1) GLOBAL MIDDLEWARES
// serving the statics files
app.use(express.static(path.join(__dirname, 'public')));

// set Security HTTP headers 
app.use(helmet());
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'data:'],
      scriptSrc: ["'self'", 'https://*.cloudflare.com'],
      scriptSrc: ["'self'", 'https://*.stripe.com'],
      styleSrc: ["self", "https://fonts.googleapis.com"],
      fontSrc: ["self", "https://fonts.gstatic.com"],
      frameSrc: ["'self'", 'https://*.stripe.com'],
      objectSrc: ["'none'"],
      styleSrc: ["'self'", 'https:', 'unsafe-inline'],
      imgSrc: ["'self'", 'https:', 'unsafe-inline'],
      upgradeInsecureRequests: [],
    },
  })
);

// Development logging
console.log(process.env.NODE_ENV);
if(process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
};

// limit request from the same api
const limiter = rateLimit({
    max: 100,
    windowMs: 60 * 60 * 1000,
    message: 'too many request please try after an hour...'
});
app.use('/api', limiter);

// Body parser, reading data from thr body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Datasanitization against NoSQL query injection
app.use(mongoSenitize());

// Datasanitization against xss attack
app.use(xss());

// prevent parameter polution
app.use(hpp({
    whitelist: ['duration', 'ratingsQuntity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price']
}));


// Just testing middleware 
app.use((req, res, next) => {
    req.requestTime = new Date().toISOString(); 
    // console.log(req.cookies);
    next();
});

// routes
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reivewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
    next(new  AppError(`can't find ${req.originalUrl} on server...`, 404));
});

app.use(globaleErrorHandler);

module.exports = app;
















