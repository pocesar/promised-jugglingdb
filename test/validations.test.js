// This test written in mocha+should.js
var j = require('../'), db, User;
var ValidationError = require('../lib/validations.js').ValidationError;

function getValidAttributes(){
  return {
    name           : 'Maria',
    email          : 'email@example.com',
    state          : '',
    bio            : 'haha',
    age            : 26,
    countryCode    : 'RU',
    gender         : 'female',
    createdByAdmin : false,
    createdByScript: true
  };
}

describe('validations', function (){

  before(function (done){
    db = getSchema();
    User = db.define('User', {
      email          : String,
      name           : String,
      password       : String,
      state          : String,
      age            : Number,
      bio            : String,
      gender         : String,
      domain         : String,
      countryCode    : String,
      pendingPeriod  : Number,
      createdByAdmin : Boolean,
      createdByScript: Boolean,
      updatedAt      : Date
    });
    db.automigrate().done(done);
  });

  beforeEach(function (done){
    User.destroyAll().then(function (){
      delete User._validations;
    }).done(done);
  });

  after(function (done){
    db.disconnect().done(done);
  });

  describe('hooks', function (){

    it('should trigger beforeValidate with data (has validations)', function (done){

      User.validatesPresenceOf('name');
      User.beforeValidate = function (next, data){
        should.exist(data)
        next(new Error('Fail'));
      };

      var user = new User;
      user.isValid(function (valid){
        // when validate hook fails, valid should be false
        valid.should.equal(false)
        done()
      }, {name: 'test'})
    });

    it('should trigger beforeValidate with data (no validations set)', function (done){
      User.beforeValidate = function (next, data){
        should.exist(data)
        data.name.should.equal('test')
        next();
      };
      var user = new User;
      user.isValid(function (valid){
        valid.should.equal(true)
        done()
      }, {name: 'test'})
    });

    it('should allow flow break by pass error to callback', function (done){

      User.beforeValidate = function (next){
        next(new Error('failed'));
      };
      User.create(function (err, model){
        should.exist(err);
        should.exist(model);
        done()
      })
    })

  })

  describe('commons', function (){

    describe('skipping', function (){

      it('should allow to skip using if: attribute', function (done){
        User.validatesPresenceOf('pendingPeriod', {if: 'createdByAdmin'});
        var user = new User();
        user.createdByAdmin = true;
        user.isValid().catch(function (){
          expect(user.errors.pendingPeriod).to.eql(['can\'t be blank']);
          user.pendingPeriod = 1;
          return user.isValid();
        }).then(function (){
          done();
        }, function (){
          expect(function (){
            throw new Error('It should succeed');
          }).to.not.throwException();
        });
      });

    });

    describe('lifecycle', function (){

      it('should work on create', function (done){
        delete User._validations;
        User.validatesPresenceOf('name');
        User.create().catch(function (){
          return User.create({name: 'Valid'});
        }).then(function (u){
          expect(u).to.be.ok();
          expect(u.name).to.equal('Valid');
        }).done(done);
      });

      it('should work on update', function (done){
        delete User._validations;
        User.validatesPresenceOf('name');

        User.create({name: 'Valid'})
          .bind({})
          .then(function (d){
            this.d = d;
            return this.d.updateAttribute('name', null);
          }).catch(function (e){
            expect(e).to.be.ok();
            expect(e).to.be.a(Error);
            expect(e).to.be.a(ValidationError);
            return this.d.updateAttribute('name', 'Vasiliy');
          }).then(function (u){
            expect(u).to.be.ok();
            expect(u.name).to.be('Vasiliy');
          }).done(done);
      });

      it('should return error code', function (done){
        delete User._validations;
        User.validatesPresenceOf('name');
        User.create().catch(function (e){
          expect(e).to.be.ok();
          expect(e.codes.name).to.eql(['presence']);
        }).done(done);
      });

      it('should allow to modify error after validation', function (done){
        User.afterValidate = function (next){
          next();
        };
        done();
      });

    });
  });

  describe('presence', function (){

    it('should validate presence', function (done){
      User.validatesPresenceOf('name', 'email');
      var u = new User();
      u.isValid().catch(function (e){
        expect(e).to.be.a(ValidationError);
        u.name = 1;
        u.email = 2;
        return u.isValid();
      }).then(function (u){
        expect(u.name).to.be('1');
      }).done(done);
    });

    it('should skip validation by property (if/unless)', function (done){
      User.validatesPresenceOf('domain', {unless: 'createdByScript'});

      var user = new User(getValidAttributes());

      user.isValid().then(function (u){
        expect(u).to.be(user);
        user.createdByScript = false;
        return user.isValid();
      }).catch(function (e){
        expect(e).to.be.a(ValidationError);
        expect(user.errors.domain).to.eql(['can\'t be blank']);
        user.domain = 'domain';
        return user.isValid();
      }).done(function (u){
        expect(u).to.be(user);
        done();
      });
    });

  });

  describe('uniqueness', function (){
    it('should validate uniqueness', function (done){
      User.validatesUniquenessOf('email');
      var user = new User({email: 'hey'});

      user.isValid().then(function (u){
        expect(u).to.be(user);
        return u.save();
      }).then(function (){
        var u2 = new User({email: 'hey'});
        return u2.isValid();
      }).catch(function (e){
        expect(e).to.be.a(ValidationError);
        expect(e.codes.email).to.eql(['uniqueness']);
      }).done(done);
    });

    it('should correctly handle null values', function (done){
      User.validatesUniquenessOf('email', {allowNull: true});
      var u = new User({email: null}), u2;
      u.isValid().then(function (user){
        expect(user).to.be(u);
        return u.save();
      }).then(function (){
        u2 = new User({email: null});
        return u2.isValid();
      }).then(function (u){
        expect(u).to.be(u2);
      }).done(done);
    });

    it('should handle same object modification', function (done){
      User.validatesUniquenessOf('email');
      var u = new User({email: 'hey'});
      u.isValid().then(function (user){
        expect(user).to.be(u);
        return u.save();
      }).then(function (){
        u.name = 'Goghi';
        return u.isValid();
      }).then(function (user){
        expect(user).to.be(u);
        return u.save();
      }).done(function (user){
        expect(user).to.be(u);
        done();
      });
    });

  });

  describe('format', function (){
    it('should validate format');
    it('should overwrite default blank message with custom format message');
  });

  describe('numericality', function (){
    it('should validate numericality');
  });

  describe('inclusion', function (){
    it('should validate inclusion');
  });

  describe('exclusion', function (){
    it('should validate exclusion');
  });

  describe('length', function (){
    it('should validate max length', function (done){
      User.validatesLengthOf('gender', {max: 6});
      var u = new User(getValidAttributes());
      u.isValid().then(function (){
        expect(u.errors).to.not.be.ok();
        u.gender = 'undefined';
        return u.isValid();
      }).catch(function (errors){
        expect(u.errors).to.be.ok();
        expect(u).to.be(errors.obj);
      }).done(done);
    });

    it('should validate min length', function (done){
      User.validatesLengthOf('bio', {min: 3});
      var u = new User({bio: 'ha'});
      u.isValid().catch(function (e){
        expect(u.errors).to.be.ok();
        expect(e).to.be.ok();
        u.bio = 'undefined';
        return u.isValid();
      }).then(function (){
        expect(u.errors).to.not.be.ok();
      }).done(done);
    });

    it('should validate exact length', function (done){
      User.validatesLengthOf('countryCode', {is: 2});
      var u = new User(getValidAttributes());
      u.isValid().then(function (){
        expect(u.errors).to.not.be.ok();
        u.countryCode = 'RUS';
        return u.isValid();
      }).catch(function (){
        expect(u.errors).to.be.ok();
      }).done(done);
    });
  });

  describe('custom', function (){
    it('should validate using custom validation', function (done){
      User.validate('countryCode', function (attr, validator, err, next){
        if (this[attr] === 'RUS') {
          err();
        }
        next();
      });
      var u = new User(getValidAttributes());

      u.isValid().then(function (){
        u.countryCode = 'RUS';
        return u.isValid();
      }).catch(function (e){
        expect(e.codes.countryCode).to.eql(['custom']);
      }).done(function (){
        done();
      });
    });
  });
});
