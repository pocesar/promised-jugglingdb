var db, Person;

describe('manipulation', function (){

  before(function (done){
    db = getSchema();

    Person = db.define('Person', {
      name     : {type: String, name: 'full_name'},
      gender   : String,
      married  : Boolean,
      age      : {type: Number, index: true},
      dob      : Date,
      createdAt: {type: Number, default: Date.now, name: 'created_at'}
    });

    db.automigrate().done(done);

  });

  describe('create', function (){

    before(function (done){
      Person.destroyAll().done(done);
    });

    it('should create instance', function (done){
      Person.create({name: 'Anatoliy'})
        .bind({})
        .then(function (p){
          this.p = p;
          expect(p.name).to.equal('Anatoliy');
          expect(p).to.be.ok();
          return Person.find(p.id);
        })
        .then(function (person){
          expect(person.id).to.equal(this.p.id);
          expect(person.name).to.equal('Anatoliy');
        })
        .done(done);
    });

    it('should return instance of object', function (done){
      Person.create().then(function (p){
        expect(p).to.be.a(Person);
        expect(p.id).to.be.ok();
      }).done(done);
    });

    it('should work when called without callback', function (done){
      Person.afterCreate = function (next){
        expect(this).to.be.a(Person);
        expect(this.name).to.equal('Nickolay');
        expect(this.id).to.be.ok();
        Person.afterCreate = null;
        next();
        setTimeout(done, 10);
      };
      Person.create({name: 'Nickolay'});
    });

    it('should create instance with blank data', function (done){
      Person
        .create()
        .bind({})
        .then(function (p){
          this.p = p;
          expect(p).to.be.ok();
          expect(p.name).to.not.be.ok();
          return Person.find(p.id);
        })
        .then(function (person){
          expect(person.id).to.equal(this.p.id);
          expect(person.name).to.not.be.ok();
        })
        .done(done);
    });

    it('should work when called with no data and callback', function (done){
      Person.afterCreate = function (next){
        expect(this).to.be.a(Person);
        expect(this.name).to.not.be.ok();
        expect(this.id).to.be.ok();
        Person.afterCreate = null;
        next();
        setTimeout(done, 30);
      };
      Person.create();
    });

    it('should create batch of objects', function (done){
      var batch = [
        {name: 'Shaltay'},
        {name: 'Boltay'},
        {}
      ];
      Person.create(batch).then(function (ps){
        expect(ps).to.be.ok();
        expect(ps).to.be.an('array');
        expect(ps).to.have.length(batch.length);

        Person.validatesPresenceOf('name');
        return Person.create(batch);
      })
        .catch(function (errors){
          delete Person._validations;
          expect(errors).to.be.ok();
          expect(errors).to.have.length(batch.length);
          expect(errors[0]).to.not.be.ok();
          expect(errors[1]).to.not.be.ok();
          expect(errors[2]).to.be.ok();
        }).done(done);
    });
  });

  describe('save', function (){

    it('should save new object', function (done){
      var p = new Person();

      p.save().then(function (){
        expect(p.id).to.be.ok();
      }).done(done);
    });

    it('should save existing object', function (done){
      Person.findOne()
        .bind({})
        .then(function (p){
          this.p = p;
          p.name = 'Hans';
          expect(p.propertyChanged('name')).to.be(true);
          return p.save();
        }).then(function (){
          expect(this.p.propertyChanged('name')).to.be(false);
          return Person.findOne();
        }).then(function (p){
          expect(p.name).to.equal('Hans');
          expect(p.propertyChanged('name')).to.be(false);
        }).done(done);
    });

    it('should save invalid object (skipping validation)', function (done){
      Person.findOne()
        .bind({})
        .then(function (p){
          p.isValid = function (){
            expect(function (){
              throw new Error('isValid should be skipped');
            }).to.not.throwError();
          };
          p.name = 'Nana';
          this.p = p;
          return p.save();
        }).catch(function (err){
          expect(err).to.be.ok();
          expect(this.p.propertyChanged('name')).to.be(true);
          return this.p.save({validate: false});
        }).then(function (p){
          expect(p.propertyChanged('name')).to.be(false);
        }).done(done);
    });

    it('should save invalid new object (skipping validation)', function (done){
      var p = new Person();
      expect(p.isNewRecord()).to.be(true);

      p.isValid = function (){
        expect(function (){
          throw new Error('isValid should be skipped');
        }).to.not.throwError();
      };

      p.save({validate: false}).then(function (){
        expect(p.isNewRecord()).to.be(false);
      }).done(done);
    });

    it('should save throw error on validation', function (done){
      Person.findOne()
        .then(function (p){
          p.isValid = function (){
            throw new Error('Invalid');
          };

          return p.save();
        })
        .catch(function (err){
          expect(err).to.be.an(Error);
        })
        .done(done);
    });

    it('should save with custom fields', function (done){
      Person.create({name: 'Anatoliy'}).then(function (p){
        expect(p.id).to.be.ok();
        expect(p.name).to.be.ok();
        expect(p['full_name']).to.not.be.ok();
        var storedObj = JSON.parse(db.adapter.cache.Person[p.id]);
        expect(storedObj['full_name']).to.be.ok();
      }).done(done);
    });
  });

  describe('updateAttributes', function (){
    var person;

    before(function (done){
      Person.destroyAll().then(function (){
        return Person.create();
      }).then(function (p){
        person = p;
      }).done(done);
    });

    it('should update one attribute', function (done){
      person
        .updateAttribute('name', 'Paul Graham')
        .then(function (p){
          return Person.all();
        })
        .then(function (ps){
          expect(ps).to.have.length(1);
          expect(ps.pop().name).to.equal('Paul Graham');
        })
        .done(done);
    });
  });

  describe('destroy', function (){

    it('should destroy record', function (done){
      Person.create()
        .bind({})
        .then(function (p){
          this.p = p;
          return p.destroy();
        }).then(function (){
          return Person.exists(this.p.id);
        }).then(function (exists){
          expect(exists).to.equal(false);
        }).done(done);
    });

    it('should destroy all records', function (done){
      Person.destroyAll().then(function (){
        return Person.all();
      }).then(function (posts){
        expect(posts).to.have.length(0);
        return Person.count();
      }).then(function (count){
        expect(count).to.be(0);
      }).done(done);
    });

    it('should destroy filtered set of records', function (done){
      for (var i = 10; i > 0; i--) {
        Person.create({age: i, married: i > 5});
      }

      Person.destroySome({where: {married: true}}).then(function (count){
        expect(count).to.be(5);
      }).done(done);
    });
  });

  describe('iterate', function (){

    before(function (done){
      var ps = [];
      for (var i = 0; i < 507; i += 1) {
        ps.push({name: 'Person ' + i});
      }
      Person.destroyAll().then(function (){
        return Person.create(ps);
      }).done(function (){
        done();
      });
    });

    it('should iterate through the batch of objects', function (done){
      var num = 0;
      Person.iterate({batchSize: 100}, function (person, next, i){
        num += 1;
        next();
      }).then(function (batches){
        expect(num).to.equal(507);
        expect(batches).to.equal(6);
      }).done(done);
    });

    it('should take limit into account', function (done){
      var num = 0;
      Person.iterate({batchSize: 20, limit: 21}, function (person, next, i){
        num += 1;
        next();
      }).then(function (batches){
        expect(num).to.equal(21);
        expect(batches).to.equal(2);
      }).done(done);
    });

    it('should process in concurrent mode', function (done){
      var num = 0, time = Date.now();
      Person.iterate({batchSize: 10, limit: 21, concurrent: true}, function (person, next, i){
        num += 1;
        setTimeout(next, 10);
      }).then(function (batches){
        expect(num).to.equal(21);
        expect(Date.now() - time <= 100).to.be(true);
        expect(batches).to.equal(3);
      }).done(done);
    });
  });

  describe('initialize', function (){
    it('should initialize object properly', function (){
      var hw = 'Hello word',
        now = Date.now(),
        person = new Person({name: hw});

      expect(person.name).to.equal(hw);
      expect(person.propertyChanged('name')).to.be(false);
      person.name = 'Goodbye, Lenin';
      expect(person.name_was).to.equal(hw);
      expect(person.propertyChanged('name')).to.be(true);
      expect(person.createdAt >= now).to.be(true);
      expect(person.isNewRecord()).to.be(true);
    });

    it('should work when constructor called as function', function (){
      var p = Person({name: 'John Resig'});
      expect(p).to.be.a(Person);
      expect(p.name).to.equal('John Resig');
    });
  });
});
