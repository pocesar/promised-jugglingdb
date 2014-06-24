global.expect = require('expect.js');
global.sinon = require('sinon');

global.JDB = require('../').JugglingDb;

var Schema = global.JDB.Schema;

if (!('getSchema' in global)) {
  global.getSchema = function (){
    return new Schema('memory');
  };
}

//var profiler = require('profiler');
//profiler.resume();
