const mongoose = require('mongoose');
const slugify = require('slugify');
// const validator = require('validator');

const tourSchema  = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'A Tour Must Have Name'],
        unique: true,
        trim: true,
        maxlength: [40, 'A Tour Must Have maxlength of 40'],
        minlength: [10, 'A Tour Must Have minlength of 10'],
        // validate: [validator.isAlpha, 'must only contain characters']
    },
    slug: String,
    duration: {
        type: Number,
        required: [true, 'A Tour Must Have duration']
    },
    maxGroupSize: {
        type: Number,
        required: [true, 'A Tour Must Have group size']
    },
    difficulty: {
        type: String,
        required: [true, 'A Tour Must Have difficulty'],
        enum: {
            values: ['easy', 'medium', 'difficult'],
            message: 'Difficulty only easy medium or difficult'
        }
    },
    ratingsAverage: {
        type: Number,
        default: 4.5,
        min: [1, 'A Tour Must Have min 1⭐️ rating'],
        max: [5, 'A Tour Must Have max 5⭐️ rating'],
        set: val => Math.round(val * 10) / 10 //4.6666, 46.666, 47, 4.7
    },
    ratingsQuantity: {
        type: Number,
        default: 0
    },
    price: {
        type: Number,
        required: [true, 'Must Have Price']
    },
    priceDiscount: {
        type: Number,
        validate: {
            validator: function(val){
                // this points only current doc on new doc creation and not works on the update
                return val < this.price;
            },
            message: 'Disscount Price ({VALUE}) should below price... '
        }
    },
    summary: {
        type: String,
        trim: true,
        required: [true, 'A Tour Must Have summary']
    }, 
    description: {
        type: String,
        trim: true
    },
    imageCover: {
        type: String,
        required: [true, 'A Tour Must Have imageCover']
    }, 
    images: [String],
    createdAt: {
        type: Date,
        default: Date.now()
    },
    startDates: [Date],
    secretTours:{
        type: Boolean,
        default: false
    },
    startLocation: {
        // GeoJSON
        type:{
            type:String,
            default: 'Point',
            enum: ['Point']
        },
        coordinates: [Number],
        address: String,
        description:String
    },
    location: [
        {
            type:{
                type:String,
                default: 'Point',
                enum: ['Point']
            },
            coordinates: [Number],
            address: String,
            description:String,
            day: Number
        }
    ],
    guides: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        }
    ]
    
},
    {
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

tourSchema.index({ price: 1, ratingsAverage: -1 });
tourSchema.index({ slug: 1 });
tourSchema.index({ startLocation: '2dsphere' });

tourSchema.virtual('durationWeeks').get(function(){
    if (this.duration) return this.duration / 7;
});

// virtual populate
tourSchema.virtual('reviews', {
    ref: 'Review',
    foreignField: 'tour',
    localField: '_id'
});

// DOCUMENT MIDDLEWARE: runs only before .save() and .create()
tourSchema.pre('save', function(next) {
    this.slug = slugify(this.name, { lower: true });
    next();
});

// QUERY MIDDLEWARE
tourSchema.pre(/^find/, function(next) {
    this.find({ secretTours: {$ne: true} })
    this.start = Date.now();
    next();
});

tourSchema.pre(/^find/, function(next) {
    // here this keyoword referece to the query like find, findByIdAndUpdate etc...because this is query middleware
    this.populate({
        path: 'guides',
        select: '-__v -passwordChangedAt'
    })
    next();
});

tourSchema.post(/^find/, function(docs, next) {
    console.log(`Took ${Date.now() - this.start } ms!`);
    // console.log(docs);
    next();
});

// AGGREGATION MIDDLEWARE
// tourSchema.pre('aggregate', function(next) {
//     this.pipeline().unshift({ $match: { secretTours: {$ne: true} }})
//     // console.log(this.pipeline());
//     next();
// })

const Tour = mongoose.model('Tour', tourSchema);

module.exports = Tour;