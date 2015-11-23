module.exports = function (grunt) {

    grunt.initConfig({

        pkg: grunt.file.readJSON('package.json'),
        
        jshint: {
            all: [
                'Gruntfile.js',
                'fs-rsync.js',
                'test/**/*Spec.js'
            ],
            options: {
                jshintrc: '.jshintrc',
            },
        },

        uglify: {
            options: {
                banner: '/*! <%= pkg.name %>@<%= pkg.version %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                src: '<%= pkg.name %>.js',
                dest: '<%= pkg.name %>.min.js'
            }
        }
    });

    // Load npm tasks.
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-jshint');

    grunt.registerTask('build', ['uglify']);

    // Default task(s).
    // By default, lint and run all tests.
    grunt.registerTask('default', ['jshint']);

};