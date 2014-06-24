var db, User;

function seed(done){
  var count = 0;
  var beatles = [
    {
      name : 'John Lennon',
      mail : 'john@b3atl3s.co.uk',
      role : 'lead',
      order: 2
    },
    {
      name : 'Paul McCartney',
      mail : 'paul@b3atl3s.co.uk',
      role : 'lead',
      order: 1
    },
    {name: 'George Harrison', order: 5},
    {name: 'Ringo Starr', order: 6},
    {name: 'Pete Best', order: 4},
    {name: 'Stuart Sutcliffe', order: 3}
  ];
  User.destroyAll().done(function (){
    beatles.forEach(function (beatle){
      User.create(beatle).done(ok);
    });
  });

  function ok(){
    if (++count === beatles.length) {
      done();
    }
  }
}

describe('basic-querying', function (){

  before(function (done){
    db = getSchema();

    User = db.define('User', {
      name : {type: String, sort: true, limit: 100},
      email: {type: String, index: true, limit: 100},
      role : {type: String, index: true, limit: 100},
      order: {type: Number, index: true, sort: true, limit: 100}
    });

    db.automigrate().done(done);

  });

  describe('find', function (){

    before(function (done){
      User.destroyAll().done(done);
    });

    it('should query by id: not found', function (done){
      User.find(1).then(function (u){
        expect(u).to.not.be.ok();
      }, function(){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      }).done(done);
    });

    it('should query by id: found', function (done){
      User.create()
      .then(function (u){
        expect(u.id).to.be.ok();
        return User.find(u.id);
      }, function(){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      })
      .then(function(u){
        expect(u).to.be.ok();
        expect(u).to.be.a(User);
      }, function(){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();

      }).done(done);
    });

  });

  describe('all', function (){

    before(seed);

    it('should query collection', function (done){
      User.all().then(function (users){
        expect(users).to.be.ok();
        expect(users).to.have.length(6);
      }).done(done);
    });

    it('should query limited collection', function (done){
      User.all({limit: 3}).then(function (users){
        expect(users).to.be.ok();
        expect(users).to.have.length(3);
      }).done(done);
    });

    it('should query offset collection with limit', function (done){
      User.all({skip: 1, limit: 4}).then(function (users){
        expect(users).to.be.ok();
        expect(users).to.have.length(4);
      }).done(done);
    });

    it('should query filtered collection', function (done){
      User.all({where: {role: 'lead'}}).then(function (users){
        expect(users).to.be.ok();
        expect(users).to.have.length(2);
      }).done(done);
    });

    it('should query collection sorted by numeric field', function (done){
      User.all({order: 'order'}).then(function (users){
        users.forEach(function (u, i){
          expect(u.order).to.be(i + 1);
        });
      }).done(done);
    });

    it('should query collection desc sorted by numeric field', function (done){
      User.all({order: 'order DESC'}).then(function (users){
        expect(users).to.be.ok();
        users.forEach(function (u, i){
          expect(u.order).to.be(users.length - i);
        });
      }).done(done);
    });

    it('should query collection sorted by string field', function (done){
      User.all({order: 'name'}).then(function (users){
        expect(users).to.be.ok();
        expect(users.shift().name).to.equal('George Harrison');
        expect(users.shift().name).to.equal('John Lennon');
        expect(users.pop().name).to.equal('Stuart Sutcliffe');
      }).done(done);
    });

    it('should query collection desc sorted by string field', function (done){
      User.all({order: 'name DESC'}).then(function (users){
        expect(users).to.be.ok();
        expect(users.pop().name).to.equal('George Harrison');
        expect(users.pop().name).to.equal('John Lennon');
        expect(users.shift().name).to.equal('Stuart Sutcliffe');
      }).done(done);
    });

    it('should accept predicate function', function(done) {
      if (db.name !== 'memory') {
        done();
        return;
      }

      User.all({where: function(item){
        return item.order > 3;
      }}).then(function(all){
        expect(all).to.have.length(3);
      }, function(){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      }).done(done);
    });

  });

  describe('count', function (){

    before(seed);

    it('should query total count', function (done){
      User.count().then(function (n){
        expect(n).to.be.ok();
        expect(n).to.equal(6);
      }).done(done);
    });

    it('should query filtered count', function (done){
      User.count({role: 'lead'}).then(function (n){
        expect(n).to.be.ok();
        expect(n).to.equal(2);
      }).done(done);
    });

  });

  describe('findOne', function (){

    before(seed);

    it('should find first record (default sort by id)', function (done){
      User
        .all({order: 'id'})
        .bind({})
        .then(function (users){
          this.users = users;
          return User.findOne();
        })
        .then(function(u){
          expect(u).to.be.ok();
          expect(u.id.toString()).to.equal(this.users[0].id.toString());
        }).done(done);
    });

    it('should find first record', function (done){
      User.findOne({order: 'order'}).then(function (u){
        expect(u).to.be.ok();
        expect(u.order).to.equal(1);
        expect(u.name).to.equal('Paul McCartney');
      }).done(done);
    });

    it('should find last record', function (done){
      User.findOne({order: 'order DESC'}).then(function (u){
        expect(u).to.be.ok();
        expect(u.order).to.equal(6);
        expect(u.name).to.equal('Ringo Starr');
      }).done(done);
    });

    it('should find last record in filtered set', function (done){
      User.findOne({
        where: {role: 'lead'},
        order: 'order DESC'
      }).then(function (u){
        expect(u).to.be.ok();
        expect(u.order).to.equal(2);
        expect(u.name).to.equal('John Lennon');
      }).done(done);
    });

    it('should work even when find by id', function (done){
      User
      .findOne()
      .then(function (u){
        return User.findOne({where: {id: u.id}});
      }).then(function (user){
        expect(user).to.be.ok();
      }).done(done);
    });

  });

  describe('exists', function (){

    before(seed);

    it('should check whether record exist', function (done){
      User
      .findOne()
      .then(function (u){
        return User.exists(u.id);
      })
      .then(function (exists){
        expect(exists).to.be.ok();
      }).done(done);
    });

    it('should check whether record not exist', function (done){
      User
      .destroyAll()
      .then(function (){
        return User.exists(42);
      }).then(function (exists){
        expect(exists).to.not.be.ok();
      }, function(){
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      }).done(done);
    });

  });

});
