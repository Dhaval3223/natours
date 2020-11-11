const multer = require('multer');
const sharp = require('sharp');
const Tour = require('../models/tourModel');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError'); 
const factory = require('./handlerFactory')


const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image')) {
        cb(null, true)
    }else {
        cb(new AppError('not an image! Please Upload an image', 400), false)
    }
}

const upload = multer({
    storage: multerStorage,
    fileFilter: multerFilter
});

exports.uploadTourImages = upload.fields([
    { name: 'imageCover', maxCount: 1},
    { name: 'images', maxCount: 3}
]);

exports.resizeTourImages = catchAsync(async (req, res, next) => {

    if(!req.files.imageCover || !req.files.images) return next();

    // 1)imageCover
    req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`
    await sharp(req.files.imageCover[0].buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90})
        .toFile(`public/img/tours/${req.body.imageCover}`);

        // 2) Images
  req.body.images = [];

  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;

      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);

      req.body.images.push(filename);
    })
  );
    next();
});

exports.aliasTopTour = (req, res, next) => {
    req.query.limit = '5';
    req.query.sort = '-ratingsAverage, price';
    req.query.fields = 'name, price, ratingsAverage, summary, difficulty';
    next();
};

// exports.getAllTours = catchAsync(async (req, res, next) => {
//     const features = new APIFeatures(Tour.find(), req.query)
//         .filter()
//         .sort()
//         .limitFields()
//         .paginate();
//     const tours = await features.query;

//     // SEND RESPONSE 
//     res.status(200).json({
//         status: 'success',
//         results: tours.length,
//         data: {
//         tours
//         }
//     });
// });

// exports.getTour = catchAsync(async (req, res, next) => {
//     const tour = await Tour.findById(req.params.id).populate('reviews');/**findById is a convenience methodon the model that's provided by Mongoose to find a document by its _id.
//     */
    
//     if (!tour) {
//         return next(new AppError('No Tour Found With This ID', 404));
//     }

//     // Tour.findOne({ _id: req.params.id })
//     res.status(200).json({
//         status: 'success',
//         data: {
//             tour
//         }
//     });
// });

// exports.createTour = catchAsync(async (req, res, next) => {
//     // olde way to create below 
//     // const newTour = new Tour();
//     // newTour.save().then();

//     // nicer way for creating ...is .create mathode
//     const newTour = await Tour.create(req.body);/**this req.body is the datathat comes from the post mathod by generating the body...and this data hten stores to the our database */
    
//     res.status(201).json({
//         status: 'success',
//         data: {
//             tours: newTour
//         }
//     });
// });
exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews'});
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

// exports.deleteTour = catchAsync(async (req, res, next) => {
//     const tour = await Tour.findByIdAndDelete(req.params.id)

//     if (!tour) {
//         return next(new AppError('No Tour Found With This ID', 404));
//     }

//     res.status(204).json({
//         status: 'success',
//         data: null 
//     });
// });

exports.getTourStates = catchAsync(async (req, res, next) => {
    const states = await Tour.aggregate([
        {
            $match: { ratingsAverage: {$gte:4.5} }
        },
        {
            $group: {
                _id: { $toUpper: '$difficulty'},
                numTours: { $sum: 1 },
                numRatings: { $sum: '$ratingsQuantity' },
                avgRating: { $avg: '$ratingsAverage' },
                avgPrice: { $avg: '$price' },
                minPrice: { $min: '$price' },
                maxPrice: { $max: '$price' },
            }
        },
        {
            $sort: { avgPrice: 1 }
        }
    ]);
    res.status(200).json({
        status: 'success',
        data: {
            states
        }
    });
});

exports.getMonthlyPlan = catchAsync(async (req, res, next) => {
    const year = req.params.year * 1; //2021
    const plan = await Tour.aggregate([
        {
            $unwind: '$startDates'
        },
        {
            $match: {
                startDates: {
                    $gte: new Date(`${year}-01-01`),
                    $lte: new Date(`${year}-12-31`),
                }
            }
        },
        {
            $group: {
                _id: { $month: '$startDates' },
                numTourStarts: { $sum: 1 },
                tours: { $push: '$name' }
            }
        },
        {
            $addFields: { month: '$_id' }
        },
        {
            $project: {
                _id: 0
            }
        },
        {
            $sort: { numTourStarts: -1 }
        }
    ])
    res.status(200).json({
        status: 'success',
        data: {
            plan
        }
    });
});

// /tours-within/:distance/center/:latlag/unit/:unit
// /tours-within/250/center/34.111745,-118.113491/unit/km

exports.getToursWithin = catchAsync(async (req, res, next) => {
    const { distance, latlag, unit } = req.params;
    const [lat, lag] = latlag.split(',');

    const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1

    if(!lat || !lag) { 
        next(new AppError('please provide latitude and lagitude in formate of lat lag', 400));
    }

    const tours = await Tour.find({
        startLocation: {
            $geoWithin: { $centerSphere: [[lag, lat], radius]}
        }
    });

    res.status(200).json({
        status: 'success',
        results: tours.length,
        data: {
            data: tours
        }
    });
});

exports.getDistances = catchAsync(async (req, res, next) => {
    const { latlag, unit } = req.params;
    const [lat, lag] = latlag.split(',');

    const multiplier = unit === 'mi' ? 0.000621371 : 0.001;

    if(!lat || !lag) { 
        next(new AppError('please provide latitude and lagitude in formate of lat lag', 400));
    }

    const distances = await Tour.aggregate([
        {
            $geoNear: {
                near: {
                    type: 'Point',
                    coordinates: [lag * 1, lat * 1]
                },
                distanceField: 'distance',
                distanceMultiplier: multiplier
            }
        },
        {
            $project: {
                distance: 1, 
                name: 1
            }
        }
    ]);

    res.status(200).json({
        status: 'success',
        data: {
            data: distances
        }
    });
});
