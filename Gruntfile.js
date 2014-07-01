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

    // Build component
    componentbuild: {
      pages: {
        options: {
          install: true
        },
        src: '.',
        dest: 'build'
      }
    }

  });

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-component-build');

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'clean', 'componentbuild']);

};
