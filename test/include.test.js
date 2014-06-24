var db, User, Post, Passport, City, Street, Building, Asset;

var createdUsers = [];

function clearAndCreate(model, data, callback){
  var createdItems = [];

  model.destroyAll().done(function (){
    nextItem(null, null);
  });

  var itemIndex = 0;

  function nextItem(err, lastItem){
    if (lastItem !== null) {
      createdItems.push(lastItem);
    }
    if (itemIndex >= data.length) {
      callback(createdItems);
      return;
    }

    model.create(data[itemIndex]).done(function (item){
      nextItem(null, item);
    }, nextItem);

    itemIndex++;
  }
}

function clearAndCreateScoped(modelName, data, scope, callback){
  var createdItems = [];

  var clearedItemIndex = 0;

  if (scope && scope.length) {
    scope.forEach(function (instance){
      instance[modelName].destroyAll().then(function (){
        clearedItemIndex++;
        if (clearedItemIndex >= scope.length) {
          createItems();
        }
      });
    });
  } else {
    callback(createdItems);
  }

  var itemIndex = 0;

  function nextItem(err, lastItem){
    itemIndex++;

    if (lastItem !== null) {
      createdItems.push(lastItem);
    }
    if (itemIndex >= data.length) {
      callback(createdItems);
      return;
    }
  }

  function createItems(){
    scope.forEach(function (instance, instanceIndex){
      instance[modelName].create(data[instanceIndex]).finally(nextItem);
    });
  }
}

function setup(done){
  db = getSchema();
  City = db.define('City');
  Street = db.define('Street');
  Building = db.define('Building');
  User = db.define('User', {
    name: String,
    age : Number
  });
  Passport = db.define('Passport', {
    number: String
  });
  Post = db.define('Post', {
    title: String
  });
  Asset = db.define('Asset', {
    url: String
  });

  Passport.belongsTo('owner', {model: User});
  User.hasMany('passports', {foreignKey: 'ownerId'});
  User.hasMany('posts', {foreignKey: 'userId'});
  Post.belongsTo('author', {model: User, foreignKey: 'userId'});
  User.hasAndBelongsToMany('assets');

  db.automigrate().done(function (){
    var createdPassports = [];
    var createdPosts = [];
    var createdAssets = [];

    function createUsers(){
      clearAndCreate(
        User,
        [
          {name: 'User A', age: 21},
          {name: 'User B', age: 22},
          {name: 'User C', age: 23},
          {name: 'User D', age: 24},
          {name: 'User E', age: 25}
        ],
        function (items){
          createdUsers = items;
          createPassports();
        }
      );
    }

    function createPassports(){
      clearAndCreate(
        Passport,
        [
          {number: '1', ownerId: createdUsers[0].id},
          {number: '2', ownerId: createdUsers[1].id},
          {number: '3'}
        ],
        function (items){
          createdPassports = items;
          createPosts();
        }
      );
    }

    function createPosts(){
      clearAndCreate(
        Post,
        [
          {title: 'Post A', userId: createdUsers[0].id},
          {title: 'Post B', userId: createdUsers[0].id},
          {title: 'Post C', userId: createdUsers[0].id},
          {title: 'Post D', userId: createdUsers[1].id},
          {title: 'Post E'}
        ],
        function (items){
          createdPosts = items;
          createAssets();
        }
      );
    }

    function createAssets(){
      clearAndCreateScoped(
        'assets',
        [
          {url: 'http://placekitten.com/200/200'},
          {url: 'http://placekitten.com/300/300'},
          {url: 'http://placekitten.com/400/400'},
          {url: 'http://placekitten.com/500/500'}
        ],
        [
          createdUsers[0],
          createdUsers[0],
          createdUsers[0],
          createdUsers[1]
        ],
        function (items){
          createdAssets = items;
          done();
        }
      );
    }

    createUsers();
  });
}

describe('include', function (){

  before(setup);

  it('should fetch belongsTo relation', function (done){
    Passport
      .all({include: 'owner'})
      .then(function (passports){
        expect(passports.length).to.be.ok();

        passports.forEach(function (p){
          expect(p.__cachedRelations).to.have.property('owner');
          var owner = p.__cachedRelations.owner;
          if (!p.ownerId) {
            expect(owner).to.not.be.ok();
          } else {
            expect(owner).to.be.ok();
            expect(owner.id).to.equal(p.ownerId);
          }
        });
      }).catch(function (e){
        expect(function (){
          throw new Error(e);
        }).to.not.throwError();
      }).done(done);
  });

  it('should fetch hasMany relation', function (done){
    User.all({include: 'posts'}).then(function (users){
      expect(users).to.be.ok();
      expect(users.length).to.be.ok();
      users.forEach(function (u){
        expect(u.__cachedRelations).to.have.property('posts');
        u.__cachedRelations.posts.forEach(function (p){
          expect(p.userId).to.equal(u.id);
        });
      });
    }).catch(function (){
      expect(function (){
        throw new Error('Should not fail');
      }).to.not.throwError();
    }).done(done);
  });

  it('should fetch hasAndBelongsToMany relation', function (done){
    User.all({include: ['assets']}).then(function (users){
      expect(users).to.be.ok();
      expect(users.length).to.be.ok();
      users.forEach(function (user){
        expect(user.__cachedRelations).to.have.property('assets');
        if (user.id === createdUsers[0].id) {
          expect(user.__cachedRelations.assets).to.have.length(3);
        }
        if (user.id === createdUsers[1].id) {
          expect(user.__cachedRelations.assets).to.have.length(1);
        }
        user.__cachedRelations.assets.forEach(function (a){
          expect(a.url.indexOf('http://placekitten.com')).to.be(0);
        });
      });
      done();
    });
  });

  it('should fetch Passport - Owner - Posts', function (done){
    Passport.all({include: {owner: 'posts'}}).then(function (passports){
      expect(passports).to.be.ok();
      expect(passports.length).to.be.ok();
      passports.forEach(function (p){
        expect(p.__cachedRelations).to.have.property('owner');
        var user = p.__cachedRelations.owner;
        if (!p.ownerId) {
          expect(user).to.not.be.ok();
        } else {
          expect(user).to.be.ok();
          expect(user.id).to.equal(p.ownerId);
          expect(user.__cachedRelations).to.have.property('posts');
          user.__cachedRelations.posts.forEach(function (pp){
            expect(pp.userId).to.equal(user.id);
          });
        }
      });
    }).catch(function (){
      expect(function (){
        throw new Error('Should not fail');
      }).to.not.throwError();
    }).done(done);
  });

  it('should fetch Passports - User - Posts - User', function (done){
    Passport.all({
      include: {owner: {posts: 'author'}}
    }).then(function (passports){
      expect(passports).to.be.ok();
      expect(passports.length).to.be.ok();
      passports.forEach(function (p){
        expect(p.__cachedRelations).to.have.property('owner');
        var user = p.__cachedRelations.owner;
        if (!p.ownerId) {
          expect(user).to.not.be.ok();
        } else {
          expect(user).to.be.ok();
          expect(user.id).to.equal(p.ownerId);
          expect(user.__cachedRelations).to.have.property('posts');
          user.__cachedRelations.posts.forEach(function (pp){
            expect(pp.userId).to.equal(user.id);
            expect(pp.__cachedRelations).to.have.property('author');
            var author = pp.__cachedRelations.author;
            expect(author.id).to.equal(user.id);
          });
        }
      });
    }).catch(function (){
      expect(function (){
        throw new Error('Should not fail');
      }).to.not.throwError();
    }).done(done);
  });

  it('should fetch User - Posts AND Passports', function (done){
    User.all({include: ['posts', 'passports']}).then(function (users){
      expect(users).to.be.ok();
      expect(users.length).to.be.ok();
      users.forEach(function (user){
        expect(user.__cachedRelations).to.have.property('posts');
        expect(user.__cachedRelations).to.have.property('passports');
        user.__cachedRelations.posts.forEach(function (p){
          expect(p.userId).to.equal(user.id);
        });
        user.__cachedRelations.passports.forEach(function (pp){
          expect(pp.ownerId).to.equal(user.id);
        });
      });
    }).catch(function (){
      expect(function (){
        throw new Error('Should not fail');
      }).to.not.throwError();
    }).done(done);
  });

  it('should fail on invalid includes', function (done){
    User.all({include: 'dontexist'}).then(function (){
      expect(function (){
        throw new Error('Should not succeed');
      }).to.not.throwException();
    }).catch(function (e){
      expect(e).to.be.an(Error);
      expect(e.message).to.equal('Relation "dontexist" is not defined for User model');
    }).done(done);
  });
});

