/*
 * Grunt Task File
 * ---------------
 *
 * Task: Styles
 * Description: Compile BBB Project Styles.
 * Dependencies: cssom
 * Tasks: stylus
 *
 */

module.exports = function(grunt) {

  var path = require("path");
  // Third-party libs.
  var cssom = require("cssom");
  var _ = grunt.utils._;
  // Shorthand Grunt functions
  var log = grunt.log;
  var file = grunt.file;

  // Needed for backwards compatibility with Stylus task.
  grunt.registerHelper("stylus", function(source, options, callback) {
    var s = require("stylus")(source);

    // load nib if available
    try {
      s.use(require("nib")());
    } catch (e) {}

    _.each(options, function(value, key) {
      s.set(key, value);
    });

    s.render(function(err, css) {
      if (err) {
        grunt.log.error(err);
        grunt.fail.warn("Stylus failed to compile.");
      } else {
        callback(css);
      }
    });
  });

  // Needed for backwards compatibility with LESS task.
  grunt.registerHelper("less", function(source, options, callback) {
    var less = require("less");

    var css;

    var parser = new less.Parser({
      paths: options.less_paths
    });

    parser.parse(source, function(parse_err, tree) {
      try {
        css = tree.toCSS(options);
        callback(css, null);
      } catch (e) {
        callback(css, true);
      }
    });
  });

  grunt.registerMultiTask("styles", "Compile project styles.", function() {

    var done = this.async();
    var target = this.target;

    // Output file.
    var output = "";
    // Options.
    var options = this.data;
    // Read in the contents.
    var contents = file.read(options.src);
    // Parse the stylesheet.
    var stylesheet = cssom.parse(contents);

    // If no CSS rules are defined, why are we even here?
    if (!Array.isArray(stylesheet.cssRules)) {
      return log.write("No css imports defined.");
    }

    if (!options.paths) {
      options.paths = [];
    }

    // Backwards compatibility, this path used to be hardcoded.
    if (!options.prefix) {
      options.prefix = "assets/css/";
    }

    options.paths.push(require("nib").path);

    // Iterate over the CSS rules, reducing to only @imports, then apply the
    // correct prefixed path to each file.  Finally, process each file and
    // concat into the output file.
    var paths = stylesheet.cssRules.reduce(function(paths, rule) {
      // If it has a path it's relevant, so add to the paths array.
      if (rule.href) {
        paths.push(rule.href);
      }

      return paths;
    }, []).map(function(path) {
      return options.prefix + path;
    }).concat(options.additional || []);

    var process = function(filepath, callback) {
      var contents = file.read(filepath);

      // Parse Stylus files.
      if (path.extname(filepath).slice(1) === "styl") {
        return grunt.helper("stylus", contents, options, function(css) {
          callback(css);
        });

      // Parse LESS files.
      } else if (path.extname(filepath).slice(1) === "less") {
        // This will allow less files to have an @import relative to itself.
        options.less_paths = [path.dirname(filepath)];
        return grunt.helper("less", contents, options, function(css) {
          callback(css);
        });
      }

      // Add vanilla CSS files.
      callback(contents);
    };

    // If the calls to process() are synchronous this acts as a simple loop.
    // But if the calls are asyncronous it will pause the loop waiting for the
    // callback.
    var asyncLoop = function(paths) {
      var checkpoint;

      var callback = function(css) {
        output += css;
        // If this call as async...
        if (checkpoint === 'after') {
          asyncLoop(paths);
        } else {
          checkpoint = 'processed';
        }
      };

      do {
        if (paths.length > 0) {
          checkpoint = 'before';
          process(paths.shift(), callback);
          if (checkpoint !== 'processed') {
            checkpoint = 'after';
          }
        } else {
          // Write out the debug file.
          file.write(target, output);

          // Success message.
          log.writeln("File " + target + " created.");
          done();
          return;
        }
      } while(checkpoint === 'processed');
    };

    asyncLoop(paths);

  });

};
