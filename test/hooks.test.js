var
  Schema = JDB.Schema,
  db, User;


function addHooks(name, done){
  var called = false, random = String(Math.floor(Math.random() * 1000));
  User['before' + name] = function (next, data){
    called = true;
    data.email = random;
    next();
  };
  User['after' + name] = function (next){
    expect(called).to.be(true);
    expect(this.email).to.equal(random);
    done();
  };
}

function removeHooks(name){
  return function (){
    User['after' + name] = null;
    User['before' + name] = null;
  };
}

describe('hooks', function (){

  before(function (done){
    db = getSchema();

    User = db.define('User', {
      email   : {type: String, index: true, limit: 100},
      name    : String,
      password: String,
      state   : String
    });

    db.automigrate().done(done);
  });

  describe('behavior', function (){

    it('should allow to break flow in case of error', function (done){

      var Model = db.define('Model');

      Model.beforeCreate = function (next, data){
        next(new Error('Fail'));
      };

      Model.create().then(function (model){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      },function (err){
        expect(err).to.be.an(Error);
        expect(err.message).to.be('Fail');
      }).done(done);
    });
  });

  describe('initialize', function (){

    afterEach(function (){
      User.afterInitialize = null;
    });

    it('should be triggered on new', function (done){
      User.afterInitialize = function (){
        done();
      };
      new User();
    });

    it('should be triggered on create', function (done){
      User.afterInitialize = function (){
        if (this.name === 'Nickolay') {
          this.name += ' Rozental';
        }
      };

      User.create({name: 'Nickolay'}).then(function (u){
        expect(u.id).to.be.ok();
        expect(u.name).to.equal('Nickolay Rozental');
      }).done(done);
    });

  });

  describe('create', function (){

    afterEach(removeHooks('Create'));

    it('should be triggered on create', function (done){
      addHooks('Create', done);
      User.create();
    });

    it('should not be triggered on new', function (){
      User.beforeCreate = function (next){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
        next();
      };
      (new User());
    });

    it('should be triggered on new+save', function (done){
      addHooks('Create', done);
      (new User()).save();
    });

    it('afterCreate should not be triggered on failed create', function (done){
      sinon.stub(User.schema.adapter, 'create', function (modelName, id, cb){
        cb(new Error('error'));
      });

      User.afterCreate = function (){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      };

      User.create().catch(function(err){
        expect(err).to.be.an(Error);
      }).done(function (){
        User.schema.adapter.create.restore();
        done();
      });
    });
  });

  describe('save', function (){
    afterEach(removeHooks('Save'));

    it('should be triggered on create', function (done){
      addHooks('Save', done);
      User.create();
    });

    it('should be triggered on new+save', function (done){
      addHooks('Save', done);
      (new User()).save();
    });

    it('should be triggered on updateAttributes', function (done){
      User.create().then(function (user){
        addHooks('Save', done);
        user.updateAttributes({name: 'Anatoliy'});
      });
    });

    it('should be triggered on save', function (done){
      User.create().then(function (user){
        addHooks('Save', done);
        user.name = 'Hamburger';
        user.save();
      });
    });

    it('should save full object', function (done){
      User.create().then(function (user){
        User.beforeSave = function (next, data){
          expect(data).to.only.have.keys('id', 'name', 'email',
            'password', 'state');
          done();
        };
        user.save();
      });
    });

    it('should save actual modifications to database', function (done){
      User.beforeSave = function (next, data){
        data.password = 'hash';
        next();
      };

      User.destroyAll().then(function (){
        return User.create({
          email   : 'james.bond@example.com',
          password: '53cr3t'
        });
      }).then(function (){
        return User.findOne({
          where: {email: 'james.bond@example.com'}
        });
      }).then(function (jb){
        expect(jb.password).to.equal('hash');
      }).done(done);
    });

    it('should save actual modifications on updateAttributes', function (done){
      User.beforeSave = function (next, data){
        data.password = 'hash';
        next();
      };
      User.destroyAll().then(function (){
        return User.create({
          email: 'james.bond@example.com'
        });
      }).then(function (u){
        return u.updateAttribute('password', 'new password');
      }).then(function (u){
        expect(u).to.be.ok();
        expect(u.password).to.equal('hash');

        return User.findOne({
          where: {email: 'james.bond@example.com'}
        });
      }).then(function (jb){
        expect(jb.password).to.equal('hash');
      }).done(done);
    });

  });

  describe('update', function (){
    afterEach(removeHooks('Update'));

    it('should not be triggered on create', function (){
      User.beforeUpdate = function (next){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
        next();
      };
      User.create();
    });

    it('should not be triggered on new+save', function (){
      User.beforeUpdate = function (next){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
        next();
      };
      (new User()).save();
    });

    it('should be triggered on updateAttributes', function (done){
      User.create().done(function (user){
        addHooks('Update', done);
        user.updateAttributes({name: 'Anatoliy'});
      });
    });

    it('should be triggered on save', function (done){
      User.create().done(function (user){
        addHooks('Update', done);
        user.name = 'Hamburger';
        user.save();
      });
    });

    it('should update limited set of fields', function (done){
      User.create().done(function (user){
        User.beforeUpdate = function (next, data){
          expect(data).to.only.have.keys('name', 'email');
          done();
        };
        user.updateAttributes({name: 1, email: 2});
      });
    });

    it('should not trigger after-hook on failed save', function (done){
      User.afterUpdate = function (){
        expect(function(){
          throw new Error('afterUpdate shouldn\'t be called');
        }).to.not.throwError();
      };

      User.create().done(function (user){
        sinon.stub(User.schema.adapter, 'save', function (modelName, id, cb){
          User.schema.adapter.save.restore();
          cb(new Error('Error'));
        });

        user.save().catch(function(err){
          expect(err).to.be.an(Error);
        }).done(function(){
          done();
        });
      });
    });
  });

  describe('destroy', function (){

    afterEach(removeHooks('Destroy'));

    it('should be triggered on destroy', function (done){
      var hook = 'not called';
      User.beforeDestroy = function (next){
        hook = 'called';
        next();
      };
      User.afterDestroy = function (next){
        expect(hook).to.eql('called');
        next();
      };
      User.create().then(function (user){
        return user.destroy();
      }).done(done);
    });

    it('should not trigger after-hook on failed destroy', function (done){
      sinon.stub(User.schema.adapter, 'destroy', function (modelName, id, cb){
        cb(new Error('error'));
      });

      User.afterDestroy = function (){
        expect(function(){
          throw new Error('afterDestroy shouldn\'t be called');
        }).to.not.throwError();
      };

      User.create().then(function (user){
        return user.destroy();
      })
      .catch(function(err){
        expect(err).to.be.an(Error);
      })
      .done(function(){
        User.schema.adapter.destroy.restore();
        done();
      });
    });

  });

  describe('lifecycle', function (){
    var life = [], user;
    before(function (done){
      User.beforeSave = function (d){
        life.push('beforeSave');
        d();
      };
      User.beforeCreate = function (d){
        life.push('beforeCreate');
        d();
      };
      User.beforeUpdate = function (d){
        life.push('beforeUpdate');
        d();
      };
      User.beforeDestroy = function (d){
        life.push('beforeDestroy');
        d();
      };
      User.beforeValidate = function (d){
        life.push('beforeValidate');
        d();
      };
      User.afterInitialize = function (){
        life.push('afterInitialize');
      };
      User.afterSave = function (d){
        life.push('afterSave');
        d();
      };
      User.afterCreate = function (d){
        life.push('afterCreate');
        d();
      };
      User.afterUpdate = function (d){
        life.push('afterUpdate');
        d();
      };
      User.afterDestroy = function (d){
        life.push('afterDestroy');
        d();
      };
      User.afterValidate = function (d){
        life.push('afterValidate');
        d();
      };
      User.create().done(function (u){
        user = u;
        life = [];
        done();
      });
    });

    beforeEach(function (){
      life = [];
    });

    it('should describe create sequence', function (done){
      User.create().done(function (){
        expect(life).to.eql([
          'afterInitialize',
          'beforeValidate',
          'afterValidate',
          'beforeCreate',
          'beforeSave',
          'afterSave',
          'afterCreate'
        ]);
        done();
      });
    });

    it('should describe new+save sequence', function (done){
      var u = new User();
      u.save().done(function (){
        expect(life).to.eql([
          'afterInitialize',
          'beforeValidate',
          'afterValidate',
          'beforeCreate',
          'beforeSave',
          'afterSave',
          'afterCreate'
        ]);
        done();
      });
    });

    it('should describe updateAttributes sequence', function (done){
      user.updateAttributes({name: 'Antony'}).done(function (){
        expect(life).to.eql([
          'beforeValidate',
          'afterValidate',
          'beforeSave',
          'beforeUpdate',
          'afterUpdate',
          'afterSave'
        ]);
        done();
      });
    });

    it('should describe isValid sequence', function (done){
      expect(user.constructor._validations).to.not.be.ok('Expected user to have no validations, but she have');
      user.isValid().then(function (){
        expect(life).to.eql([
          'beforeValidate',
          'afterValidate'
        ]);
      }, function(){
        expect(function(){
          throw new Error('Shouldn\'t throw');
        }).to.not.throwError();
      }).done(done);
    });

    it('should describe destroy sequence', function (done){
      user.destroy().done(function (){
        expect(life).to.eql([
          'beforeDestroy',
          'afterDestroy'
        ]);
        done();
      });
    });

  });
});
