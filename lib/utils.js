module.exports = function (){
  'use strict';

  var slice, utils = {
    slice: slice = Array.prototype.slice
  };

  utils.inherits = function (newClass, baseClass){
    Object.keys(baseClass).forEach(function (classMethod){
      newClass[classMethod] = baseClass[classMethod];
    });
    Object.keys(baseClass.prototype).forEach(function (instanceMethod){
      newClass.prototype[instanceMethod] = baseClass.prototype[instanceMethod];
    });
  };

  /**
   * Require a jugglingdb adapter
   * @param {String} module
   * @returns {*}
   */
  utils.safeRequire = function (module){
    try {
      return require(module);
    } catch (e) {
      console.log('Run "npm install jugglingdb ' + module + '" command to use jugglingdb using ' + module + ' database engine');
      process.exit(1);
      return false;
    }
  };

  /**
   * Bind the context of a function
   *
   * @param {Function} fn
   * @param {Object} that
   * @returns {Function}
   */
  utils.curry = function (fn, that){
    return function (){
      return fn.apply(that, arguments);
    };
  };
  /**
   * Bind the context of a function with predefined args
   *
   * @param {Function} fn
   * @param {Object} that
   * @returns {Function}
   */
  utils.curryArgs = function (fn, that){
    var args = slice.call(arguments, 2);

    return function (){
      return fn.apply(that, args.concat(slice.call(arguments)));
    };
  };

  /**
   * @typedef {Function} Promise
   * @returns {Promise}
   */
  utils.Promise = require('bluebird');

  /**
   * Define readonly property on object
   *
   * @param {Object} obj
   * @param {String} key
   * @param {*} value
   */
  utils.defineReadonlyProp = function (obj, key, value){
    Object.defineProperty(obj, key, {
      writable    : false,
      enumerable  : true,
      configurable: false,
      value       : value
    });
  };

  /**
   * Define hidden property, but overwritable
   *
   * @param {Object} where
   * @param {String} property
   * @param {*} value
   */
  utils.hiddenProperty = function (where, property, value){
    Object.defineProperty(where, property, {
      writable    : true,
      enumerable  : false,
      configurable: true,
      value       : value
    });
  };

  return utils;
};
