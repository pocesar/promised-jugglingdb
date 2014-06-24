module.exports = function (C){
  'use strict';

  /**
   * Module dependencies
   */
  var
    AbstractClass = C.AbstractClass,
    List = C.List,
    EventEmitter = require('events').EventEmitter,
    util = require('util'),
    utils = C.utils,
    path = require('path'),
    fs = require('fs'),
    curry = utils.curry,
    existsSync = fs.existsSync || path.existsSync;

  // exports.AbstractClass = AbstractClass;

  /**
   * Schema - adapter-specific classes factory.
   *
   * All classes in single schema shares same adapter type and
   * one database connection
   *
   * @param name - type of schema adapter (mysql, mongoose, sequelize, redis)
   * @param settings - any database-specific settings which we need to
   * establish connection (of course it depends on specific adapter)
   *
   * - host
   * - port
   * - username
   * - password
   * - database
   * - debug {Boolean} = false
   *
   * @example Schema creation, waiting for connection callback
   * ```
   * var schema = new Schema('mysql', { database: 'myapp_test' });
   * schema.define(...);
   * schema.on('connected', function () {
   *     // work with database
   * });
   * ```
   */
  function Schema(name, settings){
    var schema = this;

    // just save everything we get
    schema.name = name;
    schema.settings = settings || {};

    // Disconnected by default
    schema.connected = false;
    schema.connecting = false;

    // create blank models pool
    schema.models = {};
    schema.definitions = {};

    if (this.settings.log) {
      /*istanbul ignore next:untestable */
      schema.on('log', function (str, duration){
        console.log(str);
      });
    }

    // and initialize schema using adapter
    // this is only one initialization entry point of adapter
    // this module should define `adapter` member of `this` (schema)
    var adapter;
    if (typeof name === 'object') {
      adapter = name;
      this.name = adapter.name;
    } else if (name.match(/^\//)) {
      // try absolute path
      adapter = require(name);
    } else if (existsSync(__dirname + '/adapters/' + name + '.js')) {
      // try built-in adapter
      adapter = require('./adapters/' + name);
    } else {
      // try foreign adapter
      try {
        adapter = require('jugglingdb-' + name);
      } catch (e) {
        throw new Error('\nWARNING: JugglingDB adapter "' + name + '" is not installed,\nso your models cannot work, to fix run:\n\n    npm install jugglingdb-' + name, '\n');
      }
    }

    schema.connecting = true;
    adapter.initialize(schema, function (){

      schema.adapter.log = function (query, start){
        schema.log(query, start);
      };

      schema.adapter.logger = function (query){
        var
          t1 = Date.now(),
          self = this;

        return function (q){
          self.log(q || query, t1);
        };
      };

      schema.connecting = false;
      schema.connected = true;
      schema.emit('connected');
    });

    // we have an adaper now?
    if (!schema.adapter) {
      throw new Error('Adapter "' + name + '" is not defined correctly: it should define `adapter` member of schema synchronously');
    }

    schema.connect = function (cb){
      var self = this;

      return new utils.Promise(function (resolve, reject){
        self.connecting = true;

        if (typeof self.adapter.connect === 'function') {
          self.adapter.connect(function (err){
            if (!err) {
              self.connected = true;
              self.connecting = false;
              self.emit('connected');
              resolve();
            } else {
              reject(err);
            }
          });
        } else {
          resolve();
        }
      }).nodeify(cb);
    };
  }

  Schema.Text = function Text(s){ return s; };
  Schema.JSON = function JSON(){};

  Schema.types = {};
  Schema.registerType = function (type, name){
    this.types[name || type.name] = type;
  };

  Schema.registerType(Schema.Text, 'Text');
  Schema.registerType(Schema.JSON, 'JSON');

  util.inherits(Schema, EventEmitter);

  function standartize(properties, settings){
    Object.keys(properties).forEach(function (key){
      var v = properties[key];
      if (
        typeof v === 'function' ||
        typeof v === 'object' && v && v.constructor.name === 'Array'
      ) {
        properties[key] = {type: v};
      }
    });
    // TODO: add timestamps fields
    // when present in settings: {timestamps: true}
    // or {timestamps: {created: 'created_at', updated: false}}
    // by default property names: createdAt, updatedAt
  }

  /**
   * Define class
   *
   * @param {String} className
   * @param {Object} properties - hash of class properties in format
   *   `{property: Type, property2: Type2, ...}`
   *   or
   *   `{property: {type: Type}, property2: {type: Type2}, ...}`
   * @param {Object} settings - other configuration of class
   * @return {Object|Function} newly created class
   *
   * @example simple case
   * ```
   * var User = schema.define('User', {
 *     email: String,
 *     password: String,
 *     birthDate: Date,
 *     activated: Boolean
 * });
   * ```
   * @example more advanced case
   * ```
   * var User = schema.define('User', {
 *     email: { type: String, limit: 150, index: true },
 *     password: { type: String, limit: 50 },
 *     birthDate: Date,
 *     registrationDate: {type: Date, default: function () { return new Date }},
 *     activated: { type: Boolean, default: false }
 * });
   * ```
   */
  Schema.prototype.define = function defineClass(className, properties, settings){
    var schema = this;
    var args = utils.slice.call(arguments);

    if (!className) {
      throw new Error('Class name required');
    }
    if (args.length === 1) {
      properties = {};
      args.push(properties);
    }
    if (args.length === 2) {
      settings = {};
      args.push(settings);
    }

    settings = settings || {};

    if ('function' === typeof properties) {
      var props = {};
      properties({
        property: function (name, type, settings){
          settings = settings || {};
          settings.type = type;
          props[name] = settings;
        },
        set     : function (key, val){
          settings[key] = val;
        }
      });
      properties = props;
    }

    properties = properties || {};

    // every class can receive hash of data as optional param
    var NewClass = function ModelConstructor(data, schema){
      if (!(this instanceof ModelConstructor)) {
        return new ModelConstructor(data, schema);
      }
      AbstractClass.call(this, data);
      utils.hiddenProperty(this, 'schema', schema || this.constructor.schema);
    };

    utils.hiddenProperty(NewClass, 'schema', schema);
    utils.hiddenProperty(NewClass, 'settings', settings);
    utils.hiddenProperty(NewClass, 'properties', properties);
    utils.hiddenProperty(NewClass, 'modelName', className);
    utils.hiddenProperty(NewClass, 'tableName', settings.table || className);
    utils.hiddenProperty(NewClass, 'relations', {});

    // inherit AbstractClass methods
    for (var i in AbstractClass) {
      NewClass[i] = AbstractClass[i];
    }
    for (var j in AbstractClass.prototype) {
      NewClass.prototype[j] = AbstractClass.prototype[j];
    }

    NewClass.getter = {};
    NewClass.setter = {};

    standartize(properties, settings);

    // store class in model pool
    this.models[className] = NewClass;
    this.definitions[className] = {
      properties: properties,
      settings  : settings
    };

    // pass control to adapter
    this.adapter.define({
      model     : NewClass,
      properties: properties,
      settings  : settings
    });

    NewClass.prototype.__defineGetter__('id', function (){
      return this.__data.id;
    });

    properties.id = properties.id || {type: schema.settings.slave ? String : Number};

    NewClass.forEachProperty = function (cb){
      Object.keys(properties).forEach(cb);
    };

    NewClass.registerProperty = function (attr){
      var DataType = properties[attr].type;
      if (DataType instanceof Array) {
        DataType = List;
      } else if (DataType.name === 'Date') {
        var OrigDate = Date;
        DataType = function Date(arg){
          return new OrigDate(arg);
        };
      } else if (DataType.name === 'JSON' || DataType === Schema.JSON) {
        DataType = function JSON(s){
          return s;
        };
      } else if (DataType.name === 'Text' || DataType === Schema.Text) {
        DataType = function Text(s){
          return s;
        };
      }

      Object.defineProperty(NewClass.prototype, attr, {
        get         : function (){
          if (NewClass.getter[attr]) {
            return NewClass.getter[attr].call(this);
          } else {
            return this.__data[attr];
          }
        },
        set         : function (value){
          if (NewClass.setter[attr]) {
            NewClass.setter[attr].call(this, value);
          } else {
            if (value === null || value === undefined || typeof DataType === 'object') {
              this.__data[attr] = value;
            } else if (DataType === Boolean) {
              this.__data[attr] = value === 'false' ? false : !!value;
            } else {
              this.__data[attr] = DataType(value);
            }
          }
        },
        configurable: true,
        enumerable  : true
      });

      NewClass.prototype.__defineGetter__(attr + '_was', function (){
        return this.__dataWas[attr];
      });

      Object.defineProperty(NewClass.prototype, '_' + attr, {
        get         : function (){
          return this.__data[attr];
        },
        set         : function (value){
          this.__data[attr] = value;
        },
        configurable: true,
        enumerable  : false
      });
    };

    NewClass.forEachProperty(NewClass.registerProperty);

    this.emit('define', NewClass, className, properties, settings);

    return NewClass;
  };

  /**
   * Define single property named `prop` on `model`
   *
   * @param {String} model - name of model
   * @param {String} prop - name of propery
   * @param {Object} params - property settings
   */
  Schema.prototype.defineProperty = function (model, prop, params){
    this.definitions[model].properties[prop] = params;
    this.models[model].registerProperty(prop);

    if (typeof this.adapter.defineProperty === 'function') {
      this.adapter.defineProperty(model, prop, params);
    }
  };

  /**
   * Extend existing model with bunch of properties
   *
   * @param {String} model - name of model
   * @param {Object} props - hash of properties
   *
   * Example:
   *
   *     // Instead of doing this:
   *
   *     // amend the content model with competition attributes
   *     db.defineProperty('Content', 'competitionType', { type: String });
   *     db.defineProperty('Content', 'expiryDate', { type: Date, index: true });
   *     db.defineProperty('Content', 'isExpired', { type: Boolean, index: true });
   *
   *     // schema.extend allows to
   *     // extend the content model with competition attributes
   *     db.extendModel('Content', {
 *       competitionType: String,
 *       expiryDate: { type: Date, index: true },
 *       isExpired: { type: Boolean, index: true }
 *     });
   */
  Schema.prototype.extendModel = function (model, props){
    var t = this;
    standartize(props, {});
    Object.keys(props).forEach(function (propName){
      var definition = props[propName];
      t.defineProperty(model, propName, definition);
    });
  };

  function executeInAdapter(context, name, resolve, reject){

    if (typeof context.adapter[name] === 'function') {
      if (context.adapter[name].length === 1) {
        context.adapter[name](function (err, res){
          if (err) {
            return reject(err);
          }
          resolve(res);
        });
      } else {
        resolve(context.adapter[name]());
      }
      return true;
    } else {
      resolve();
    }

    return false;
  }

  /**
   * Drop each model table and re-create.
   * This method make sense only for sql adapters.
   *
   * @warning All data will be lost! Use autoupdate if you need your data.
   *
   * @param {Function} [cb] Optional callback
   * @returns {PromiseResolver.promise}
   */
  Schema.prototype.automigrate = function (cb){
    this.freeze();

    return new utils.Promise(curry(function (resolve, reject){
      executeInAdapter(this, 'automigrate', resolve, reject);
    }, this)).nodeify(cb);
  };

  /**
   * Update existing database tables.
   * This method make sense only for sql adapters.
   *
   * @param {Function} [cb] Optional callback
   * @returns {PromiseResolver.promise}
   */
  Schema.prototype.autoupdate = function (cb){
    this.freeze();

    return new utils.Promise(curry(function (resolve, reject){
      executeInAdapter(this, 'autoupdate', resolve, reject);
    }, this)).nodeify(cb);
  };

  /**
   * Check whether migrations needed
   * This method make sense only for sql adapters.
   *
   * @param {Function} [cb] Optional callback
   * @returns {PromiseResolver.promise}
   */
  Schema.prototype.isActual = function (cb){
    this.freeze();

    return new utils.Promise(curry(function (resolve, reject){
      executeInAdapter(this, 'isActual', resolve, reject);
    }, this)).nodeify(cb);
  };

  /**
   * Log benchmarked message. Do not redefine this method, if you need to grab
   * schema logs, use `schema.on('log', ...)` emitter event
   *
   * @private used by adapters
   */
  Schema.prototype.log = function (sql, t){
    this.emit('log', sql, t);
  };

  /**
   * Freeze schema. Behavior depends on adapter
   */
  Schema.prototype.freeze = function freeze(){
    if (typeof this.adapter.freezeSchema === 'function') {
      this.adapter.freezeSchema();
    }
  };

  /**
   * Backward compatibility. Use model.tableName prop instead.
   * Return table name for specified `modelName`
   * @param {String} modelName
   */
  Schema.prototype.tableName = function (modelName){
    return this.models[modelName].model.tableName;
  };

  /**
   * Define foreign key
   * @param {String} className
   * @param {String} key - name of key field
   * @param {String} foreignClassName
   */
  Schema.prototype.defineForeignKey = function defineForeignKey(className, key, foreignClassName){
    // quit if key already defined
    if (this.definitions[className].properties[key]) {
      return;
    }

    if (typeof this.adapter.defineForeignKey === 'function') {

      var cb = curry(function (err, keyType){
        if (err) {
          throw err;
        }
        this.definitions[className].properties[key] = {type: keyType};
      }, this);

      switch (this.adapter.defineForeignKey.length) {
        case 4:
          this.adapter.defineForeignKey(className, key, foreignClassName, cb);
          break;
        default:
        case 3:
          this.adapter.defineForeignKey(className, key, cb);
          break;
      }
    } else {
      this.definitions[className].properties[key] = {type: Number};
    }
    this.models[className].registerProperty(key);
  };

  /**
   * Close database connection
   *
   * @param {Function} [cb] Optional callback
   * @returns {PromiseResolver.promise}
   */
  Schema.prototype.disconnect = function disconnect(cb){
    return new utils.Promise(curry(function (resolve, reject){
      if (executeInAdapter(this, 'disconnect', resolve, reject)) {
        this.connected = false;
      }
    }, this)).nodeify(cb);
  };

  Schema.prototype.copyModel = function copyModel(Master){
    var schema = this;
    var className = Master.modelName;
    var md = Master.schema.definitions[className];
    var Slave = function SlaveModel(){
      Master.apply(this, utils.slice.call(arguments));
      this.schema = schema;
    };

    util.inherits(Slave, Master);

    Slave.__proto__ = Master;

    utils.hiddenProperty(Slave, 'schema', schema);
    utils.hiddenProperty(Slave, 'modelName', className);
    utils.hiddenProperty(Slave, 'tableName', Master.tableName);
    utils.hiddenProperty(Slave, 'relations', Master.relations);

    if (!(className in schema.models)) {

      // store class in model pool
      schema.models[className] = Slave;
      schema.definitions[className] = {
        properties: md.properties,
        settings  : md.settings
      };

      if (!schema.isTransaction) {
        schema.adapter.define({
          model     : Slave,
          properties: md.properties,
          settings  : md.settings
        });
      }

    }

    return Slave;
  };

  Schema.prototype.transaction = function (){
    var schema = this;
    var transaction = new EventEmitter();
    transaction.isTransaction = true;
    transaction.origin = schema;
    transaction.name = schema.name;
    transaction.settings = schema.settings;
    transaction.connected = false;
    transaction.connecting = false;
    transaction.adapter = schema.adapter.transaction();

    // create blank models pool
    transaction.models = {};
    transaction.definitions = {};

    for (var i in schema.models) {
      schema.copyModel.call(transaction, schema.models[i]);
    }

    transaction.connect = schema.connect;

    transaction.exec = function (cb){
      return new utils.Promise(function (resolve, reject){
        transaction.adapter.exec(function (err, res){
          if (err) {
            return reject(err);
          }
          resolve(res);
        });
      }).nodeify(cb);
    };

    return transaction;
  };

  /**
   * Export public API
   */
  return Schema;
};
