const express = require('express');
const tourController = require('../controller/toursController');
const authController = require('../controller/authController');
const reviewRouter = require('./reviewRoutes');

const router = express.Router();


// router
//     .route('/:tourId/reviews')
//     .post(authController.protect, 
//         authController.restrictTo('user'), 
//         reviewController.createReview);

router.use('/:tourId/reviews', reviewRouter)

// router.param('id', tourController.checkID);
router
    .route('/top-5-cheap')
    .get(tourController.aliasTopTour, tourController.getAllTours);

router
    .route('/tour-states')
    .get(tourController.getTourStates);

router
    .route('/monthly-plan/:year')
    .get(
        authController.protect, 
        authController.restrictTo('admin', 'lead-guide', 'guides'),
        tourController.getMonthlyPlan
    );

router
    .route('/tours-within/:distance/center/:latlag/unit/:unit')
    .get(tourController.getToursWithin)
// /tours-within/250/center/50,200/unit/km

router
    .route('/distances/:latlag/unit/:unit')
    .get(tourController.getDistances)

router
    .route('/')
    .get(tourController.getAllTours)
    .post(
        authController.protect, 
        authController.restrictTo('admin', 'lead-guide'), 
        tourController.createTour
    );

router
    .route('/:id')
    .get(tourController.getTour)
    .patch(
        authController.protect, 
        authController.restrictTo('admin', 'lead-guide'), 
        tourController.uploadTourImages,
        tourController.resizeTourImages,
        tourController.updateTour
    )
    .delete(
        authController.protect, 
        authController.restrictTo('admin', 'lead-guide'), 
        tourController.deleteTour
    );

module.exports = router;