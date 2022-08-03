const gulp = require('gulp');
const shell = require('gulp-shell');

//run on android device after a full build
gulp.task('android', gulp.series(shell.task(
    'npx cap copy'
)));

//run on ios device after a full build
gulp.task('ios', gulp.series(shell.task(
    'npx cap copy'
)));

gulp.task('web', gulp.series(shell.task(
    'ionic serve --browser=opera'
)));