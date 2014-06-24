module.exports = function (C){
  'use strict';

  /**
   * Dependencies
   */
  var
    i8n = require('inflection'),
    utils = C.utils,
    defineScope = C.Scope;

  /**
   * Relations mixins for ./model.js
   */
  var AbstractClass = C.AbstractClass;

  AbstractClass.relationNameFor = function relationNameFor(foreignKey){
    for (var rel in this.relations) {
      if (this.relations[rel].type === 'belongsTo' && this.relations[rel].keyFrom === foreignKey) {
        return rel;
      }
    }
  };

  /**
   * Declare hasMany relation
   *
   * @param {Model} anotherClass - class to has many
   * @param {Object} params - configuration {as:, foreignKey:}
   * @example `User.hasMany(Post, {as: 'posts', foreignKey: 'authorId'});`
   */
  AbstractClass.hasMany = function hasMany(anotherClass, params){
    var thisClass = this, thisClassName = this.modelName;
    params = params || {};
    if (typeof anotherClass === 'string') {
      params.as = anotherClass;
      if (params.model) {
        anotherClass = params.model;
      } else {
        var anotherClassName = i8n.singularize(anotherClass).toLowerCase();
        for (var name in this.schema.models) {
          if (name.toLowerCase() === anotherClassName) {
            anotherClass = this.schema.models[name];
          }
        }
      }
    }
    var methodName = params.as ||
      i8n.camelize(i8n.pluralize(anotherClass.modelName), true);
    var fk = params.foreignKey || i8n.camelize(thisClassName + '_id', true);

    this.relations[methodName] = {
      type    : 'hasMany',
      keyFrom : 'id',
      keyTo   : fk,
      modelTo : anotherClass,
      multiple: true
    };

    function find(id, cb){
      /*jshint validthis:true */
      var self = this;

      return anotherClass.find(id).then(function (inst){
        if (!inst) {
          throw new Error('Not found');
        }
        if (inst[fk] && inst[fk].toString() === self.id.toString()) {
          return inst;
        } else {
          throw new Error('Permission denied');
        }
      }).nodeify(cb);
    }

    function destroy(id, cb){
      /*jshint validthis:true */
      var self = this;

      return anotherClass.find(id).then(function (inst){
        if (!inst) {
          throw new Error('Not found');
        }
        if (inst[fk] && inst[fk].toString() === self.id.toString()) {
          return inst.destroy();
        } else {
          throw new Error('Permission denied');
        }
      }).nodeify(cb);
    }

    // each instance of this class should have method named
    // pluralize(anotherClass.modelName)
    // which is actually just anotherClass.all({where: {thisModelNameId: this.id}}, cb);
    var scopeMethods = {
      find   : find,
      destroy: destroy
    };

    if (params.through) {

      // Append through relation, like modelTo
      this.relations[methodName].modelThrough = params.through;

      var fk2 = i8n.camelize(anotherClass.modelName + '_id', true);

      scopeMethods.create = function hasManyCreate(data, done){
        if (typeof data === 'function') {
          done = data;
          data = {};
        }

        var
          self = this,
          id = this.id;

        return anotherClass.create(data).then(function (ac){
          var d = {};
          d[params.through.relationNameFor(fk)] = self;
          d[params.through.relationNameFor(fk2)] = ac;

          return params.through.create(d)
            .catch(function (){
              return ac.destroy();
            }).then(function (){
              return ac;
            });
        }).nodeify(done);
      };

      scopeMethods.add = function hasManyAdd(acInst, data, done){
        if (typeof data === 'function') {
          done = data;
          data = {};
        }

        data = data || {};

        var query = {};
        query[fk] = this.id;
        data[params.through.relationNameFor(fk)] = this;
        query[fk2] = acInst.id || acInst;
        data[params.through.relationNameFor(fk2)] = acInst;

        return params.through
          .findOrCreate({where: query}, data)
          .nodeify(done);
      };

      scopeMethods.remove = function hasManyRemove(acInst, done){
        var q = {};
        q[fk] = this.id;
        q[fk2] = acInst.id || acInst;

        return params.through.findOne({where: q}).then(function (d){
          return d.destroy();
        }).nodeify(done);
      };

      delete scopeMethods.destroy;
    }

    defineScope(this.prototype, params.through || anotherClass, methodName, function hasManyScope(){
      var filter = {};
      filter.where = {};
      filter.where[fk] = this.id;
      if (params.through) {
        filter.collect = i8n.camelize(anotherClass.modelName, true);
        filter.include = filter.collect;
      }
      return filter;
    }, scopeMethods);

    if (!params.through) {
      // obviously, anotherClass should have attribute called `fk`
      anotherClass.schema.defineForeignKey(anotherClass.modelName, fk, this.modelName);
    }
  };

  /**
   * Declare belongsTo relation
   *
   * @param {Class} anotherClass - class to belong
   * @param {Object} params - configuration {as: 'propertyName', foreignKey: 'keyName'}
   *
   * **Usage examples**
   * Suppose model Post have a *belongsTo* relationship with User (the author of the post). You could declare it this way:
   * Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
   *
   * When a post is loaded, you can load the related author with:
   * post.author().then(function(author) {
 *     // the user variable is your user object
 * });
   *
   * The related object is cached, so if later you try to get again the author, no additional request will be made.
   * But there is an optional boolean parameter in first position that set whether or not you want to reload the cache:
   * post.author(true).then(function(author) {
 *     // The user is reloaded, even if it was already cached.
 * });
   *
   * This optional parameter default value is false, so the related object will be loaded from cache if available.
   */
  AbstractClass.belongsTo = function (anotherClass, params){
    var Model = this;
    params = params || {};
    if ('string' === typeof anotherClass) {
      params.as = anotherClass;
      if (params.model) {
        anotherClass = params.model;
      } else {
        var anotherClassName = anotherClass.toLowerCase();
        for (var name in this.schema.models) {
          if (name.toLowerCase() === anotherClassName) {
            anotherClass = this.schema.models[name];
          }
        }
      }
    }
    var methodName = params.as || i8n.camelize(anotherClass.modelName, true);
    var fk = params.foreignKey || methodName + 'Id';

    this.relations[methodName] = {
      type    : 'belongsTo',
      keyFrom : fk,
      keyTo   : 'id',
      modelTo : anotherClass,
      multiple: false
    };

    this.schema.defineForeignKey(this.modelName, fk, anotherClass.modelName);
    this.prototype['__finders__'] = this.prototype['__finders__'] || {};

    this.prototype['__finders__'][methodName] = function belongsToFinder(id, cb){
      if (id === null || id === undefined) {
        return utils.Promise.resolve(null).nodeify(cb);
      }

      var
        inst = this;

      return anotherClass.find(id).then(function (_inst){
        if (!_inst) {
          return null;
        } else if (_inst.id.toString() === inst[fk].toString()) {
          return _inst;
        } else {
          throw new Error('Permission denied');
        }
      }).nodeify(cb);
    };

    this.prototype[methodName] = function belongsToPrototype(refresh, p){
      if (arguments.length === 1) {
        p = refresh;
        refresh = false;
      } else if (arguments.length > 2) {
        throw new Error('Method can\'t be called with more than two arguments');
      }

      return new utils.Promise(utils.curry(function (resolve, reject){
        var cachedValue;

        if (!refresh && this.__cachedRelations && (typeof this.__cachedRelations[methodName] !== 'undefined')) {
          cachedValue = this.__cachedRelations[methodName];
        }

        if (p instanceof Model) { // acts as setter
          this[fk] = p.id;
          this.__cachedRelations[methodName] = p;
          resolve(this);
        } else if (typeof p !== 'undefined' && typeof p !== 'function') { // setter
          this[fk] = p;
          delete this.__cachedRelations[methodName];
          resolve(this);
        } else {
          // async getter
          if (typeof cachedValue === 'undefined') {
            this.__finders__[methodName].call(this, this[fk]).bind(this).done(function (inst){
              this.__cachedRelations[methodName] = inst;
              resolve(inst);
            }, function (err){
              reject(err);
            });
          } else {
            resolve(cachedValue);
          }
        }
      }, this)).bind(this).nodeify(p);
    };

  };

  /**
   * Many-to-many relation
   *
   * Post.hasAndBelongsToMany('tags'); creates connection model 'PostTag'
   */
  AbstractClass.hasAndBelongsToMany = function hasAndBelongsToMany(anotherClass, params){
    params = params || {};
    var models = this.schema.models;

    function lookupModel(modelName){
      var lookupClassName = modelName.toLowerCase();
      for (var name in models) {
        if (name.toLowerCase() === lookupClassName) {
          return models[name];
        }
      }
      return null;
    }

    if ('string' === typeof anotherClass) {
      params.as = anotherClass;
      if (params.model) {
        anotherClass = params.model;
      } else {
        anotherClass = lookupModel(i8n.singularize(anotherClass)) ||
        anotherClass;
      }
      if (typeof anotherClass === 'string') {
        throw new Error('Could not find "' + anotherClass + '" relation for ' + this.modelName);
      }
    }

    if (!params.through) {
      var name1 = this.modelName + anotherClass.modelName;
      var name2 = anotherClass.modelName + this.modelName;
      params.through = lookupModel(name1) || lookupModel(name2) ||
      this.schema.define(name1);
    }
    params.through.belongsTo(this);
    params.through.belongsTo(anotherClass);

    this.hasMany(anotherClass, {as: params.as, through: params.through});

  };

};
