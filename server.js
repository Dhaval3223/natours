const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', err => {
    console.log(err.name, err.message);
    console.log('UNHANDLEDERROR 💥: shutting down...');
    process.exit(1);
});


dotenv.config({ path: './config.env' });

const app = require('./app');


const DB = process.env.DATABASE.replace('<PASSWORD>', process.env.DATABASE_PASSWORD);

mongoose.connect(DB, {
// just some options to deal with deprecation warnings.
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true
})
.then(() => console.log('DB connection successful!'));

// const testTour = new Tour ({
//     name: 'The Forest Hiker',
//     rating: 4.7,
//     price: 497
// });


const port = process.env.PORT;
const server = app.listen( port, () => {
    console.log(`'listning to port ${port}..'`);
});

process.on('unhandledRejection', err => {
    console.log(err.name, err.message);
    console.log('UNHANDLEDERROR 💥: shutting down...');
    server.close(() => {
        process.exit(1);
    })
});


// console.log(x); /*this is uncaughtException*/