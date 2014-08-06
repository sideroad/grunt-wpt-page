/*
 * grunt-wpt-page
 * https://github.com/sideroad/grunt-wpt-page
 *
 * Copyright (c) 2013 sideroad
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'index.js',
      ],
      options: {
        jshintrc: '.jshintrc',
      },
    },

    clean: ['build', 'components'],

    concat: {
      pages: {
        src: [
          'jquery.min.js',
          'morris-0.5.1.min.js',
          'raphael-min.js'
        ],
        dest: 'build/lib.js'
      }
    }

  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-concat');

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'clean', 'concat']);

};
