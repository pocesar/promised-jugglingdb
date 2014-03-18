'use strict';

/**
 * Module exports class Model
 */
module.exports = AbstractClass;

/**
 * Module dependencies
 */
var
  util = require('util'),
  utils = require('./utils'),
  curry = utils.curry,
  validations = require('./validations.js'),
  ValidationError = validations.ValidationError,
  List = require('./list.js');

require('./hooks.js');
require('./relations.js');
require('./include.js');

var BASE_TYPES = ['String', 'Boolean', 'Number', 'Date', 'Text'];

/**
 * AbstractClass class - base class for all persist objects
 * provides **common API** to access any database adapter.
 * This class describes only abstract behavior layer, refer to `lib/adapters/*.js`
 * to learn more about specific adapter implementations
 *
 * `AbstractClass` mixes `Validatable` and `Hookable` classes methods
 *
 * @constructor
 * @param {Object} data - initial object data
 */
function AbstractClass(data){
  this._initProperties(data, true);
}

AbstractClass.prototype._initProperties = function (data, applySetters){
  var self = this;
  var ctor = this.constructor;
  var ds = ctor.schema.definitions[ctor.modelName];
  var properties = ds.properties;
  data = data || {};

  if (typeof data === 'string') {
    data = JSON.parse(data);
  }

  utils.hiddenProperty(this, '__cachedRelations', {});
  utils.hiddenProperty(this, '__data', {});
  utils.hiddenProperty(this, '__dataWas', {});

  if (data['__cachedRelations']) {
    this.__cachedRelations = data['__cachedRelations'];
  }

  for (var i in data) {
    if (i in properties) {
      this.__data[i] = this.__dataWas[i] = data[i];
    } else if (i in ctor.relations) {
      this.__data[ctor.relations[i].keyFrom] = this.__dataWas[i] = data[i][ctor.relations[i].keyTo];
      this.__cachedRelations[i] = data[i];
    }
  }

  if (applySetters === true) {
    Object.keys(data).forEach(function (attr){
      self[attr] = data[attr];
    });
  }

  ctor.forEachProperty(function (attr){

    if ('undefined' === typeof self.__data[attr]) {
      self.__data[attr] = self.__dataWas[attr] = getDefault(attr);
    } else {
      self.__dataWas[attr] = self.__data[attr];
    }

  });

  ctor.forEachProperty(function (attr){

    var type = properties[attr].type;

    if (BASE_TYPES.indexOf(type.name) === -1) {
      if (typeof self.__data[attr] !== 'object' && self.__data[attr]) {
        try {
          self.__data[attr] = JSON.parse(self.__data[attr] + '');
        } catch (e) {
          self.__data[attr] = String(self.__data[attr]);
        }
      }
      if (type.name === 'Array' || typeof type === 'object' && type.constructor.name === 'Array') {
        self.__data[attr] = new List(self.__data[attr], type, self);
      }
    }

  });

  function getDefault(attr){
    var def = properties[attr]['default'];
    if (isdef(def)) {
      if (typeof def === 'function') {
        return def();
      } else {
        return def;
      }
    } else {
      return undefined;
    }
  }

  this.trigger('initialize');
};

/**
 * @param {String} prop - property name
 * @param {Object} params - various property configuration
 */
AbstractClass.defineProperty = function (prop, params){
  this.schema.defineProperty(this.modelName, prop, params);
};

AbstractClass.whatTypeName = function (propName){
  var prop = this.schema.definitions[this.modelName].properties[propName];
  if (!prop || !prop.type) {
    return null;
    // throw new Error('Undefined type for ' + this.modelName + ':' + propName);
  }
  return prop.type.name;
};

/**
 * Updates the respective record
 *
 * @param {Object} params - { where:{uid:'10'}, update:{ Name:'New name' } }
 * @param {Function} [cb] Optional callback
 *
 * @returns {Promise.promise}
 */
AbstractClass.update = function update(params, cb){
  var Model = this;

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    if (params && params.update && typeof params.update !== 'function') {
      params.update = Model._forDB(params.update);
    }

    Model.schema.adapter.update(Model.modelName, params, function (err, obj){
      if (err) {
        d.reject(err);
      } else {
        d.resolve(Model._fromDB(obj));
      }
    });

    return d.promise;
  }).nodeify(cb);
};

/**
 * Prepares data for storage adapter.
 *
 * Ensures data is allowed by the schema, and stringifies JSON field types.
 * If the schema defines a custom field name, it is transformed here.
 *
 * @param {Object} data
 * @return {Object} Returns data for storage.
 */
AbstractClass._forDB = function (data){
  if (!data) {
    return null;
  }
  var
    res = {},
    Model = this,
    definition = this.schema.definitions[Model.modelName].properties;

  Object.keys(data).forEach(function (propName){
    var val;
    var typeName = Model.whatTypeName(propName);

    if (!typeName && !data[propName] instanceof Array) {
      return;
    }
    val = data[propName];
    if (definition[propName] && definition[propName].name) {
      // Use different name for DB field/column
      res[definition[propName].name] = val;
    } else {
      res[propName] = val;
    }
  });

  return res;
};

/**
 * Unpacks data from storage adapter.
 *
 * If the schema defines a custom field name, it is transformed here.
 *
 * @param {Object} data
 * @return {Object}
 */
AbstractClass._fromDB = function (data){
  if (!data) {
    return null;
  }

  var
    definition = this.schema.definitions[this.modelName].properties,
    propNames = Object.keys(data);

  Object.keys(definition).forEach(function (defPropName){
    var customName = definition[defPropName].name;
    if (customName && propNames.indexOf(customName) !== -1) {
      data[defPropName] = data[customName];
      delete data[customName];
    }
  });

  return data;
};

AbstractClass.prototype.whatTypeName = function (propName){
  return this.constructor.whatTypeName(propName);
};

/**
 * Create new instance of Model class, saved in database
 *
 * @param data [optional]
 * @param {Function} [cb] Optional callback
 *
 * @returns {PromiseResolver.promise}
 */
AbstractClass.create = function create(data, cb){
  var
    Model = this;

  if (typeof data === 'function') {
    cb = data;
    data = {};
  }

  return stillConnecting(Model.schema).then(function (){
    var
      d = utils.defer(),
      modelName = Model.modelName;

    data = data || {};

    // Passed via data from save
    var options = data.options || {validate: true};

    if (data.data instanceof Model) {
      data = data.data;
    }

    if (data instanceof Array) {
      var
        instances = [],
        length = data.length,
        errors,
        gotError = false,
        wait = length;

      if (length === 0) {
        d.resolve([]);
      } else {
        errors = new Array(length);

        var modelCreated = function (){
          if (--wait === 0) {
            if (gotError) {
              d.reject(errors);
            } else {
              d.resolve(instances);
            }
          }
        };

        var createModel = function (d, i){
          Model.create(d).catch(function (err){
            if (err) {
              errors[i] = err;
              gotError = true;
            }
            modelCreated();
          }).done(function (inst){
            instances.push(inst);
            modelCreated();
          });
        };

        for (var i = 0; i < length; i += 1) {
          createModel(data[i], i);
        }
      }
    } else {
      var
        obj,
        reject = curry(d.reject, d),
        innerCreate = function (){
          obj.trigger('create', function (createDone){
            obj.trigger('save', function (saveDone){
              obj._adapter().create(modelName, Model._forDB(obj.toObject(true)), function adapterCreate(err, id, rev){
                if (id) {
                  obj.__data.id = id;
                  obj.__dataWas.id = id;
                  utils.defineReadonlyProp(obj, 'id', id);
                }
                if (rev) {
                  rev = Model._fromDB(rev);
                  obj._rev = rev;
                }
                if (err) {
                  d.reject(err);
                } else {
                  saveDone.call(obj, function saveDoneCall(){
                    createDone.call(obj, function createDoneCall(){
                      d.resolve(obj);
                    });
                  });
                }
              }, obj);
            }, obj, reject);
          }, obj, reject);
        };

      // if we come from save
      if (data instanceof Model && !data.id) {
        obj = data;
      } else {
        obj = new Model(data);
      }
      data = obj.toObject(true);

      if (!options.validate) {
        innerCreate();
      } else {
        // validation required
        obj.isValid(data).done(
          innerCreate,
          function (err){
            d.reject(err);
          }
        );
      }
    }

    return d.promise;
  }).nodeify(cb);
};

/**
 *
 * @param schema
 *
 * @returns {PromiseResolver.promise}
 */
function stillConnecting(schema){
  var d = utils.defer();

  if (schema.connected) {
    d.resolve();
  } else {
    schema.once('connected', function (){
      d.resolve();
    });

    if (!schema.connecting) {
      schema.connect();
    }
  }

  return d.promise;
}

/**
 * Update or insert
 *
 * @param {Object} data
 * @param {Function} [cb] Optional callback
 */
AbstractClass.upsert = AbstractClass.updateOrCreate = function upsert(data, cb){
  var Model = this;

  return stillConnecting(Model.schema).then(function (){
    if (!data.id) {
      return Model.create(data);
    }

    var
      d = utils.defer(),
      resolve = curry(d.resolve, d),
      reject = curry(d.reject, d);

    if (typeof Model.schema.adapter.updateOrCreate === 'function') {
      var inst = new Model(data);

      Model.schema.adapter.updateOrCreate(Model.modelName, Model._forDB(inst.toObject(true)), function (err, data){
        var obj;

        if (data) {
          data = inst.constructor._fromDB(data);
          inst._initProperties(data);
          obj = inst;
        } else {
          obj = null;
        }

        if (err) {
          d.reject(err);
        } else {
          d.resolve(obj);
        }
      });
    } else {
      Model.find(data.id).done(function (inst){
        if (inst) {
          inst.updateAttributes(data).done(resolve, reject);
        } else {
          var obj = new Model(data);
          obj.save(data).done(resolve, reject);
        }
      }, reject);
    }

    return d.promise;
  }).nodeify(cb);
};

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection,
 * if not found, create using data provided as second argument
 *
 * @param {Object} query - search conditions: {where: {test: 'me'}}.
 * @param {Object|Function} data - object to create.
 * @param {Function} [cb] Optional callback
 * @returns {PromiseResolver.promise}
 */
AbstractClass.findOrCreate = function findOrCreate(query, data, cb){
  if (typeof query === 'undefined') {
    query = {where: {}};
  }

  if (typeof data === 'function' || typeof data === 'undefined') {
    data = query && query.where;
  }

  var Model = this;

  return Model.findOne(query).then(function (record){
    if (record) {
      return record;
    }
    return Model.create(data);
  }).nodeify(cb);
};

/**
 * Check whether object exitst in database
 *
 * @param {id} id - identifier of object (primary key value)
 * @param {Function} [cb] Optional callback
 */
AbstractClass.exists = function exists(id, cb){
  var Model = this;

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    if (id) {
      Model.schema.adapter.exists(Model.modelName, id, d.callback);
    } else {
      d.reject(new Error('Model::exists requires positive id argument'));
    }

    return d.promise;
  }).nodeify(cb);
};

/**
 * Find object by id
 *
 * @param {id} id - primary key value
 * @param {Function} [cb] Optional callback
 *
 * @returns {PromiseResolver.promise}
 */
AbstractClass.find = function find(id, cb){
  var Model = this;

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    Model.schema.adapter.find(Model.modelName, id, function (err, data){
      var obj = null;

      if (data) {
        data = Model._fromDB(data);
        if (!data.id) {
          data.id = id;
        }
        obj = new Model();
        obj._initProperties(data, false);
      }

      if (err) {
        d.reject(err);
      } else {
        d.resolve(obj);
      }
    });

    return d.promise;
  }).nodeify(cb);
};

/**
 * Find all instances of Model, matched by query
 * make sure you have marked as `index: true` fields for filter or sort
 *
 * @param {Object} params (optional)
 *
 * - where: Object `{ key: val, key2: {gt: 'val2'}}`
 * - include: String, Object or Array. See AbstractClass.include documentation.
 * - order: String
 * - limit: Number
 * - skip: Number
 *
 * @param {Function} [cb] Optional callback
 *
 * @returns {PromiseResolver.promise}
 */
AbstractClass.all = function all(params, cb){
  var Model = this;

  if (typeof params === 'function') {
    cb = params;
    params = {};
  }

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    if (params) {
      if ('skip' in params) {
        params.offset = params.skip;
      } else if ('offset' in params) {
        params.skip = params.offset;
      }
    }

    if (params && params.where && typeof params.where !== 'function') {
      params.where = Model._forDB(params.where);
    }

    Model.schema.adapter.all(Model.modelName, params, function (err, data){
      if (data && data.forEach) {

        if (!params || !params.onlyKeys) {

          data.forEach(function (_data, i){
            var obj = new Model();
            _data = Model._fromDB(_data);
            obj._initProperties(_data, false);
            if (params && params.include && params.collect) {
              data[i] = obj.__cachedRelations[params.collect];
            } else {
              data[i] = obj;
            }
          });
        }

        if (err) {
          d.reject(err);
        } else {
          d.resolve(data);
        }
      } else {
        if (err) {
          d.reject(err);
        } else {
          d.resolve([]);
        }
      }
    });

    return d.promise;
  }).nodeify(cb);
};

/**
 * Iterate through dataset and perform async method iterator. This method
 * designed to work with large datasets loading data by batches.
 *
 * @param {Object|Function} filter - query conditions. Same as for `all` may contain
 * optional member `batchSize` to specify size of batch loaded from db. Optional.
 * @param {Function} iterator - method(obj, next) called on each obj.
 * @param {Function} [cb] Optional callback
 */
AbstractClass.iterate = function map(filter, iterator, cb){
  var
    Model = this,
    d = utils.defer();

  if ('function' === typeof filter) {
    iterator = filter;
    filter = {};
  }

  function done(err){
    if (err) {
      d.reject(err);
    } else {
      d.resolve(batchNumber);
    }
  }

  var concurrent = filter.concurrent;
  delete filter.concurrent;
  var limit = filter.limit;
  var batchSize = filter.limit = filter.batchSize || 1000;
  var batchNumber = -1;

  nextBatch();

  function nextBatch(){
    batchNumber += 1;
    filter.skip = filter.offset = batchNumber * batchSize;

    if (limit < batchSize) {
      filter.limit = Math.abs(limit);
    }

    if (filter.limit <= 0) {
      done();
      return;
    }

    Model.all(filter).done(function (collection){
      if (collection.length === 0 || limit <= 0) {
        done();
        return;
      }

      var nextItem = function (err){
        if (err) {
          done(err);
          return;
        }

        if (++i >= collection.length) {
          nextBatch();
          return;
        }

        iterator(collection[i], nextItem, filter.offset + i);
      };

      limit -= collection.length;
      var i = -1;
      if (concurrent) {
        var wait = collection.length, _next;

        _next = function (){
          if (--wait === 0) {
            nextBatch();
          }
        };

        collection.forEach(function (obj, i){
          iterator(obj, _next, filter.offset + i);
        });
      } else {
        nextItem();
      }
    }, curry(d.reject, d));
  }

  return d.promise.nodeify(cb);
};

/**
 * Find one record, same as `all`, limited by 1 and return object, not collection
 *
 * @param {Object} params - search conditions: {where: {test: 'me'}}
 * @param {Function} [cb] Optional callback
 */
AbstractClass.findOne = function findOne(params, cb){
  var Model = this;

  if (typeof params === 'function') {
    cb = params;
    params = {};
  }

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    params = typeof params === 'object' ? params : {};
    params.limit = 1;

    Model.all(params).done(function (collection){
      if (!collection || collection.length === 0) {
        d.resolve(null);
      } else {
        d.resolve(collection[0]);
      }
    }, curry(d.reject, d));

    return d.promise;
  }).nodeify(cb);
};

/**
 * Destroy all records
 * @param {Function} [cb] Optional callback
 */
AbstractClass.destroyAll = function destroyAll(cb){
  var Model = this;

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    Model.schema.adapter.destroyAll(Model.modelName, function (err){
      if (err) {
        d.reject(err);
      } else {
        d.resolve();
      }
    });

    return d.promise;
  }).nodeify(cb);
};

/**
 * Delete some objects from persistence
 *
 * @triggers `destroy` hook (async) before and after destroying object
 * @param {Object|Function} query
 * @param {Function} [cb] Optional callback
 */
AbstractClass.destroySome = function destroySome(query, cb){
  var Model = this;

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    Model.all(query).then(function (ids){
      if (!ids || !ids.length) {
        throw new Error('No items found to destroy');
      }
      var all = [];
      ids.forEach(function (id){
        all.push(id.destroy());
      });
      utils.Q.all(all).done(function (count){
        d.resolve(count.length);
      });
    }).catch(function (err){
      d.reject(err);
    }).done();

    return d.promise;
  }).nodeify(cb);
};

/**
 * Return count of matched records
 *
 * @param {Object} query - search conditions (optional)
 * @param {Function} [cb] Optional callback
 */
AbstractClass.count = function count(query, cb){
  var Model = this;

  if (typeof query === 'function') {
    cb = query;
    query = null;
  }

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    if (typeof query === 'object') {
      if (typeof query.where !== 'function') {
        query = Model._forDB(query);
      }
    } else {
      query = null;
    }

    Model.schema.adapter.count(Model.modelName, d.callback, query);

    return d.promise;
  }).nodeify(cb);
};

/**
 * Return string representation of class
 *
 * @override default toString method
 */
AbstractClass.toString = function (){
  return '[Model ' + this.modelName + ']';
};

/**
 * Save instance. When instance haven't id, create method called instead.
 * Triggers: validate, save, update | create
 * @param {Object} [options] {validate: true}
 * @param {Function} [cb] Optional callback
 */
AbstractClass.prototype.save = function save(options, cb){
  var
    Model = this.constructor,
    inst = this;

  if (typeof options === 'function') {
    cb = options;
    options = {};
  }

  return stillConnecting(Model.schema).then(function (){
    options = typeof options === 'object' ? options : {};

    if (!('validate' in options)) {
      options.validate = true;
    }

    var data = inst.toObject(true);
    var modelName = Model.modelName;

    if (!inst.id) {
      // Pass options and this to create
      data = {
        data   : inst,
        options: options
      };

      return Model.create(data);
    }

    // then save
    var
      d = utils.defer(),
      reject = curry(d.reject, d),
      innerSave = function (){
        inst.trigger('save', function (saveDone){
          inst.trigger('update', function (updateDone){
            inst._adapter().save(modelName, inst.constructor._forDB(data), function (err){
              if (err) {
                d.reject(err);
              } else {
                inst._initProperties(data, false);
                updateDone.call(inst, function (){
                  saveDone.call(inst, function (){
                    d.resolve(inst);
                  });
                });
              }
            });
          }, data, reject);
        }, data, reject);
      };

    // validate first
    if (!options.validate) {
      innerSave();
    } else {
      inst.isValid(data).done(function (){
        innerSave();
      }, reject);
    }

    return d.promise;
  }).nodeify(cb);
};

AbstractClass.prototype.isNewRecord = function (){
  return !this.id;
};

/**
 * Return adapter of current record
 * @private
 */
AbstractClass.prototype._adapter = function (){
  return this.schema.adapter;
};

/**
 * Convert instance to Object
 *
 * @param {Boolean} onlySchema - restrict properties to schema only, default false
 * when onlySchema == true, only properties defined in schema returned,
 * otherwise all enumerable properties returned.
 * @param {Boolean} cachedRelations - include cached relations to object, only
 * taken into account when onlySchema is false.
 * @returns {Object} - canonical object representation (no getters and setters).
 */
AbstractClass.prototype.toObject = function (onlySchema, cachedRelations){
  var data = {};
  var ds = this.constructor.schema.definitions[this.constructor.modelName];
  var properties = ds.properties;
  var self = this;

  this.constructor.forEachProperty(function (attr){
    if (self[attr] instanceof List) {
      data[attr] = self[attr].toObject();
    } else if (self.__data.hasOwnProperty(attr)) {
      data[attr] = self[attr];
    } else {
      data[attr] = null;
    }
  });

  if (!onlySchema) {
    Object.keys(self).forEach(function (attr){
      if (!data.hasOwnProperty(attr)) {
        data[attr] = self[attr];
      }
    });

    if (cachedRelations === true && this.__cachedRelations) {
      var relations = this.__cachedRelations;
      Object.keys(relations).forEach(function (attr){
        if (!data.hasOwnProperty(attr)) {
          data[attr] = relations[attr];
        }
      });
    }
  }

  return data;
};

// AbstractClass.prototype.hasOwnProperty = function (prop) {
//     return this.__data && this.__data.hasOwnProperty(prop) ||
//         Object.getOwnPropertyNames(this).indexOf(prop) !== -1;
// };

AbstractClass.prototype.toJSON = function (){
  return this.toObject(false, true);
};

/**
 * Delete object from persistence
 *
 * @triggers `destroy` hook (async) before and after destroying object
 * @param {Function} [cb] Optional callback
 */
AbstractClass.prototype.destroy = function destroy(cb){
  var
    Model = this.constructor,
    inst = this;

  return stillConnecting(Model.schema).then(function (){
    var d = utils.defer();

    inst.trigger('destroy', function (destroyed){
      inst._adapter().destroy(Model.modelName, inst.id, function (err){
        if (err) {
          d.reject(err);
        } else {
          destroyed(curry(d.resolve, d));
        }
      });
    }, inst.toObject(), curry(d.reject, d));

    return d.promise;
  }).nodeify(cb);
};

/**
 * Update single attribute
 *
 * equals to `updateAttributes({name: value}, cb)
 *
 * @param {String} name - name of property
 * @param {*} value - value of property
 * @param {Function} [cb] Optional callback
 */
AbstractClass.prototype.updateAttribute = function updateAttribute(name, value, cb){
  var data = {};
  data[name] = value;
  return this.updateAttributes(data, cb);
};

/**
 * Update set of attributes
 *
 * this method performs validation before updating
 *
 * @trigger `validation`, `save` and `update` hooks
 * @param {Object} data - data to update
 * @param {Function} [cb] Optional callback
 */
AbstractClass.prototype.updateAttributes = function updateAttributes(data, cb){
  var
    Model = this.constructor,
    inst = this;

  return stillConnecting(Model.schema).then(function (){
    var
      modelName = Model.modelName,
      d = utils.defer(),
      reject = curry(d.reject, d);

    data = typeof data === 'object' ? data : {};

    // update instance's properties
    Object.keys(data).forEach(function (key){
      inst[key] = data[key];
    });

    inst.isValid(data).done(function (){
      inst.trigger('save', function (saveDone){
        inst.trigger('update', function (done){

          Object.keys(data).forEach(function (key){
            inst[key] = data[key];
          });

          inst._adapter().updateAttributes(modelName, inst.id, inst.constructor._forDB(inst.toObject(true)), function (err){
            if (!err) {
              // update _was attrs
              Object.keys(data).forEach(function (key){
                inst.__dataWas[key] = inst.__data[key];
              });
            }

            done.call(inst, function (){
              saveDone.call(inst, function (){
                if (err) {
                  d.reject(err);
                } else {
                  d.resolve(inst);
                }
              });
            });
          });
        }, data, reject);
      }, data, reject);
    }, reject);

    return d.promise;
  }).nodeify(cb);
};

AbstractClass.prototype.fromObject = function (obj){
  var inst = this;
  Object.keys(obj).forEach(function (key){
    inst[key] = obj[key];
  });
};

/**
 * Checks is property changed based on current property and initial value
 *
 * @param {String} attr - property name
 * @return Boolean
 */
AbstractClass.prototype.propertyChanged = function propertyChanged(attr){
  return this.__data[attr] !== this.__dataWas[attr];
};

/**
 * Reload object from persistence
 *
 * @requires id member of `object` to be able to call `find`
 * @param {Function} [cb] Optional callback
 */
AbstractClass.prototype.reload = function reload(cb){
  var
    Model = this.constructor,
    inst = this;

  return stillConnecting(Model.schema).then(function (){
    return Model.find(inst.id);
  }).nodeify(cb);
};

/**
 * Reset dirty attributes
 *
 * this method does not perform any database operation it just reset object to it's
 * initial state
 */
AbstractClass.prototype.reset = function (){
  var obj = this;

  Object.keys(obj).forEach(function (k){
    if (k !== 'id' && !obj.constructor.schema.definitions[obj.constructor.modelName].properties[k]) {
      delete obj[k];
    }
    if (obj.propertyChanged(k)) {
      obj[k] = obj[k + '_was'];
    }
  });
};

AbstractClass.prototype.inspect = function (){
  return util.inspect(this.__data, false, 4, true);
};

/**
 * Check whether `s` is not undefined
 * @param {*} s
 * @return {Boolean} s is undefined
 */
function isdef(s){
  var undef;
  return s !== undef;
}
