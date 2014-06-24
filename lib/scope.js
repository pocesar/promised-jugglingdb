module.exports = function (C){
  'use strict';

  var
    AbstractClass = C.AbstractClass,
    Promise = C.utils.Promise,
    curry = C.utils.curry;

  /**
   * Merge `base` and `update` params
   * @param {Object} base - base object (updating this object)
   * @param {Object} update - object with new data to update base
   * @returns {Object} `base`
   */
  function merge(base, update){
    base = base || {};
    if (update) {
      Object.keys(update).forEach(function (key){
        base[key] = update[key];
      });
    }
    return base;
  }

  function defineScope(cls, targetClass, name, params, methods){

    // collect meta info about scope
    if (!cls._scopeMeta) {
      cls._scopeMeta = {};
    }

    // only makes sence to add scope in meta if base and target classes
    // are same
    if (cls === targetClass) {
      cls._scopeMeta[name] = params;
    } else {
      if (!targetClass._scopeMeta) {
        targetClass._scopeMeta = {};
      }
    }

    Object.defineProperty(cls, name, {
      enumerable  : false,
      configurable: true,
      get         : function (){
        var f = function caller(condOrRefresh, cb){
          var
            actualCond = {},
            actualRefresh = false,
            saveOnCache = true;

          if (arguments.length === 1) {
            if (typeof condOrRefresh === 'function') {
              cb = condOrRefresh;
            } else if (typeof condOrRefresh === 'boolean') {
              actualRefresh = condOrRefresh;
            } else {
              actualCond = condOrRefresh;
              actualRefresh = true;
              saveOnCache = false;
            }
          } else if (arguments.length === 2) {
            if (typeof condOrRefresh === 'boolean') {
              actualRefresh = condOrRefresh;
            } else {
              actualCond = condOrRefresh;
              actualRefresh = true;
              saveOnCache = false;
            }
          } else if (arguments.length > 2) {
            throw new Error('Method can be only called with zero, one or two arguments');
          }

          return new Promise(curry(function (resolve, reject){
            if (!this.__cachedRelations || (typeof this.__cachedRelations[name] == 'undefined') || actualRefresh) {
              var self = this;
              var params = mergeParams(actualCond, caller._scope);

              targetClass.all(params).done(function (data){
                if (saveOnCache) {
                  if (!self.__cachedRelations) {
                    self.__cachedRelations = {};
                  }
                  self.__cachedRelations[name] = data;
                }

                resolve(data);
              }, reject);
            } else {
              resolve(this.__cachedRelations[name]);
            }
          }, this)).nodeify(cb);
        };
        f._scope = typeof params === 'function' ? params.call(this) : params;
        f.build = build;
        f.create = create;
        f.destroyAll = destroyAll;
        for (var i in methods) {
          f[i] = curry(methods[i], this);
        }

        // define sub-scopes
        Object.keys(targetClass._scopeMeta).forEach(function (name){
          Object.defineProperty(f, name, {
            enumerable: false,
            get       : function (){
              mergeParams(f._scope, targetClass._scopeMeta[name]);
              return f;
            }
          });
        });
        return f;
      }
    });

    // and it should have create/build methods with binded thisModelNameId param
    function build(data){
      /*jshint validthis:true */
      return new targetClass(mergeParams(this._scope, {where: data || {}}).where);
    }

    function create(data, cb){
      /*jshint validthis:true */
      return this.build(data).save().nodeify(cb);
    }

    /*
     Callback
     - The callback will be called after all elements are destroyed
     - For every destroy call which results in an error
     - If fetching the Elements on which destroyAll is called results in an error
     */
    function destroyAll(cb){
      /*jshint validthis:true */
      var inst = this;

      return targetClass.all(inst._scope).then(function (data){
        return new Promise(function (resolve, reject){
          (function loopOfDestruction(data){
            if (data.length > 0) {
              data.shift().destroy().done(function (){
                loopOfDestruction(data);
              }, reject);
            } else {
              resolve(inst);
            }
          })(data);
        });
      }).nodeify(cb);
    }

    function mergeParams(base, update){
      if (update.where) {
        base.where = merge(base.where, update.where);
      }
      if (update.include) {
        base.include = update.include;
      }
      if (update.collect) {
        base.collect = update.collect;
      }

      // overwrite order
      if (update.order) {
        base.order = update.order;
      }

      return base;

    }
  }

  /**
   * Define scope
   * TODO: describe behavior and usage examples
   */
  AbstractClass.scope = function (name, params){
    defineScope(this, this, name, params);
  };

  /**
   * Module exports
   */
  return defineScope;
};
