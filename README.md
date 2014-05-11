[![Stories in Ready](https://badge.waffle.io/1602/jugglingdb.png?label=ready)](https://waffle.io/1602/jugglingdb)  [![Coverage Status](https://coveralls.io/repos/pocesar/promised-jugglingdb/badge.png?branch=master)](https://coveralls.io/r/pocesar/promised-jugglingdb?branch=master) [![Build Status](https://travis-ci.org/pocesar/promised-jugglingdb.svg?branch=master)](https://travis-ci.org/pocesar/promised-jugglingdb)

## Reasoning behind creating a promise based version

Dealing with database is always an asynchronous task by nature. You query something,
the database needs to process your command, and then send you the results. Node is
built around callbacks and events, and to tame it to avoid callback hell and
unmaintainable code, promises were created.

This version is the dual API, along with the original callback based, it's promise based
version of Jugglindb, and will be maintained to be kept up-to-date with the original.
All adapters should work with this version out-of-the-box.

See API differences below.

* Every function that would return a value now return a promise
* Validation is async only
* Since everything is made properly asynchronous now, `process.nextTick` and `setImmediate` were removed from the code
* Functions that would act as getter and setters now return the object itself when acting as a setter

## About

[JugglingDB(3)](http://jugglingdb.co) is cross-db ORM for nodejs, providing
**common interface** to access most popular database formats.  Currently
supported are: mysql, sqlite3, postgres, couchdb, mongodb, redis, neo4j and
js-memory-storage (yep, self-written engine for test-usage only). You can add
your favorite database adapter, checkout one of the existing adapters to learn
how, it's super-easy, I guarantee.

Jugglingdb also works on client-side (using WebService and Memory adapters),
which allows to write rich client-side apps talking to server using JSON API.

## Installation

```bash
npm install promised-jugglingdb
```

plus you should install appropriated adapter, for example for redis:

```bash
    npm install jugglingdb-redis
```

check following list of available adapters

## What's the difference?

Take this callback based jugglingdb code

```javascript
  Article.create({title: 'Article 1'}, function (e, article1){
    Article.create({title: 'Article 2'}, function (e, article2){
      Tag.create({name: 'correct'}, function (e, tag){
        article1.tags.add(tag, function (e, at){
          article2.tags.add(tag, function (e, at){
            article2.tags.remove(tag, function (e){
              article2.tags(true, function (e, tags){
                article1.tags(true, function (e, tags){
                    // is it hell?
                });
              });
            });
          });
        });
      });
    });
  });
```

And compare to this:

```javascript
Article
.create({title: 'Article 1'})
.bind({})
//since we are dealing with 3 models, we need to be able to pass them around
.then(function(article1){
    this.article1 = article1;
    return Article.create({title: 'Article 2'});
})
.then(function(article2){
    this.article2 = article2;
    return Tag.create({name: 'correct'});
})
.then(function(tag){
    this.tag = tag;
    return this.article1.tags.add(tag);
})
.then(function(){
    return this.article2.tags.add(this.tag);
})
.then(function(){
    return this.article2.tags.remove(this.tag);
})
.then(function(){
    return this.article2.tags(true);
})
.then(function(){
    return this.article1.tags(true);
})
.catch(TypeError, ReferenceError, function(err){
    console.log('A programming error ocurred', err);
})
.catch(ValidationError, function(err){
    console.log('A validation error ocurred', err);
})
.done(function(tags){
    console.log('Finished with article1 tags', tags);
});

```

which can be written as:

```javascript
var Q = require('bluebird');
Q.all([
    Article.create({title: 'Article 1'}),
    Article.create({title: 'Article 2'}),
    Tag.create({name: 'correct'})
])
.spread(function(article1, article2, tag){
    return Q.all([article1.tags.add(tag),article2.tags.add(tag),article2.tags.remove(tag)])
            .then(Q.all([article2.tags(true),article1.tags(true)]));
}).spread(function(article1Tags, article2Tags){
    console.log('Finished with article1 and article2 tags', article1Tags, article2Tags);
}).catch(TypeError, ReferenceError, function(err){
    console.log('A programming error ocurred', err);
}).catch(ValidationError, function(err){
    console.log('A validation error ocurred', err);
});
```

Or this:

```javascript
    db.automigrate(function (){
      Book.destroyAll(function (){
        Chapter.destroyAll(function (){
          Author.destroyAll(function (){
            Reader.destroyAll(done);
          });
        });
      });
    });
```

to

```javascript
    db.automigrate().then(function (){
      return Book.destroyAll();
    }).then(function (){
      return Chapter.destroyAll();
    }).then(function (){
      return Author.destroyAll();
    }).then(function (){
      return Reader.destroyAll();
    }).done(done);
```

or even better

```javascript
    require('bluebird').all([
        db.automigrate(),
        Book.destroyAll(),
        Chapter.destroyAll(),
        Author.destroyAll(),
        Reader.destroyAll()
    ]).done(done);
```

More verbose, but everything in it's place, and the flow is linear and easy to spot any errors, plus each error or
exception goes to their own `catch` call since if any error or exception happens in any of the calls, it will be
caught by the `catch` part of the chain, and it won't procceed.

Everything will be executed in order, and can be watched and easily tested, in comparision
the to callback hell, that's deeply nested and might lead to memory leaks.

## JugglingDB adapters

<table>
  <thead>
    <tr>
      <th>Database type</th>
      <th>Package name</th>
      <th>Maintainer</th>
      <th>Build status</th>
    </tr>
  </thead>
  <tbody>
    <!-- Firebird -->
    <tr>
      <td><a href="http://firebirdsql.org" target="_blank"><img src="https://raw.github.com/pocesar/promised-jugglingdb/master/media/firebird.ico" alt="Firebird"/></a> Firebird</td>
      <td><a href="http://github.com/hgourvest/jugglingdb-firebird" target="_blank">jugglingdb-firebird</a></td>
      <td><a href="http://github.com/hgourvest" target="_blank">Henri Gourvest</a></td>
      <td></td>
    </tr>

    <!-- MongoDB -->
    <tr>
      <td><a href="http://www.mongodb.org" target="_blank"><img src="https://raw.github.com/pocesar/promised-jugglingdb/master/media/mongodb.ico" alt="MongoDB" /></a> MongoDB</td>
      <td><a href="https://github.com/jugglingdb/mongodb-adapter" target="_blank">jugglingdb/mongodb-adapter</a></td>
      <td><a href="https://github.com/anatoliychakkaev" target="_blank">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/jugglingdb/mongodb-adapter" target="_blank"><img src="https://travis-ci.org/jugglingdb/mongodb-adapter.svg?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- MySQL -->
    <tr>
      <td><a href="http://www.mysql.com/" target="_blank"><img src="https://raw.github.com/pocesar/promised-jugglingdb/master/media/mysql.ico" style="vertical-align:middle"" alt="MySQL" /></a> MySQL</td>
      <td><a href="https://github.com/jugglingdb/mysql-adapter" target="_blank">jugglingdb/mysql</a></td>
      <td><a href="https://github.com/dgsan" target="_blank">dgsan</a></td>
      <td><a href="https://travis-ci.org/jugglingdb/mysql-adapter" target="_blank"><img src="https://travis-ci.org/jugglingdb/mysql-adapter.svg?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- CouchDB / nano -->
    <tr>
      <td><a href="http://couchdb.apache.org/" target="_blank"><img width="16" src="https://raw.github.com/pocesar/promised-jugglingdb/master/media/couchdb.ico" style="vertical-align:middle"" alt="CouchDB" /></a> CouchDB / nano</td>
      <td><a href="https://github.com/jugglingdb/nano-adapter" target="_blank">jugglingdb/nano-adapter</a></td>
      <td><a href="https://github.com/nrw" target="_blank">Nicholas Westlake</a></td>
      <td><a href="https://travis-ci.org/jugglingdb/nano-adapter" target="_blank"><img src="https://travis-ci.org/jugglingdb/nano-adapter.svg?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- PostgreSQL -->
    <tr>
      <td><a href="http://www.postgresql.org/" target="_blank"><img src="http://www.postgresql.org/favicon.ico" style="vertical-align:middle"" alt="PostgreSQL" /></a> PostgreSQL</td>
      <td><a href="https://github.com/jugglingdb/postgres-adapter" target="_blank">jugglingdb/postgres-adapter</a></td>
      <td><a href="https://github.com/anatoliychakkaev" target="_blank">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/jugglingdb/postgres-adapter" target="_blank"><img src="https://travis-ci.org/jugglingdb/postgres-adapter.svg?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- Redis -->
    <tr>
      <td><a href="http://redis.io/" target="_blank"><img src="http://redis.io/images/favicon.png" alt="Redis" /></a> Redis</td>
      <td><a href="https://github.com/jugglingdb/redis-adapter" target="_blank">jugglingdb-redis</a></td>
      <td><a href="https://github.com/anatoliychakkaev" target="_blank">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/jugglingdb/redis-adapter" target="_blank"><img src="https://travis-ci.org/jugglingdb/redis-adapter.svg?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- RethinkDB -->
    <tr>
      <td><a href="http://www.rethinkdb.com/" target="_blank"><img src="https://raw.github.com/pocesar/promised-jugglingdb/master/media/rethinkdb.ico" alt="RethinkDB" width="16" height="16" /></a> RethinkDB</td>
      <td><a href="https://github.com/fuwaneko/jugglingdb-rethink" target="_blank">jugglingdb-rethink</a></td>
      <td><a href="https://github.com/fuwaneko" target="_blank">Dmitry Gorbunov</a></td>
      <td><a href="https://travis-ci.org/fuwaneko/jugglingdb-rethink" target="_blank"><img src="https://travis-ci.org/fuwaneko/jugglingdb-rethink.svg?branch=master" alt="Build Status" /></a></td>
    </tr>

    <!-- SQLite -->
    <tr>
      <td><a href="http://www.sqlite.org/" target="_blank"><img width="16" src="https://raw.github.com/1602/jugglingdb/master/media/sqlite.png" style="vertical-align:middle" alt="SQLite" /></a> SQLite</td>
      <td><a href="https://github.com/jugglingdb/sqlite3-adapter" target="_blank">jugglingdb/sqlite3-adapter</a></td>
      <td><a href="https://github.com/anatoliychakkaev" target="_blank">Anatoliy Chakkaev</a></td>
      <td><a href="https://travis-ci.org/jugglingdb/sqlite3-adapter" target="_blank"><img src="https://travis-ci.org/jugglingdb/sqlite3-adapter.svg?branch=master" alt="Build Status" /></a></td>
    </tr>
    <!-- ArangoDB -->
    <tr>
      <td><a href="http://www.arangodb.org/"><img src="https://raw.github.com/pocesar/promised-jugglingdb/master/media/arangodb.ico" style="vertical-align:middle" alt="ArangoDB" /></a> ArangoDB</td>
      <td><a href="https://github.com/m0ppers/jugglingdb-arango">jugglingdb-arango</a></td>
      <td><a href="https://github.com/m0ppers">Andreas Streichardt</a></td>
      <td><a href="https://travis-ci.org/m0ppers/jugglingdb-arango"><img src="https://travis-ci.org/m0ppers/jugglingdb-arango.svg?branch=master" alt="Build Status" /></a></td>
    </tr>
    <tr>
      <td>WebService</td>
      <td>built-in</td>
      <td><a href="https://github.com/anatoliychakkaev" target="_blank">Anatoliy Chakkaev</a></td>
      <td>n/a</td>
    </tr>
    <tr>
      <td>Memory (bogus)</td>
      <td>built-in</td>
      <td><a href="https://github.com/anatoliychakkaev" target="_blank">Anatoliy Chakkaev</a></td>
      <td>n/a</td>
    </tr>
    <tr>
      <td>Neo4j</td>
      <td>built-in <i>TODO: move</i></td>
      <td><a href="https://github.com/anatoliychakkaev" target="_blank">Anatoliy Chakkaev</a> :warning: Looking for
      maintainer</td>
      <td>n/a</td>
    </tr>

  </tbody>
</table>

## Participation

- Check status of project on trello board: https://trello.com/board/jugglingdb/4f0a0b1e27d3103c64288388
- Make sure all tests pass (`npm test` command)
- Feel free to vote and comment on cards (tickets/issues), if you want to join team -- send me a message with your email.

If you want to create your own jugglingdb adapter, you should publish your
adapter package with name `jugglingdb-ADAPTERNAME`. Creating adapter is simple,
check [jugglingdb/redis-adapter](https://github.com/jugglingdb/redis-adapter) for example.
For more information, see the [Testing](#testing) section below.

## Usage

```javascript
var Schema = require('promised-jugglingdb').Schema;
var schema = new Schema('redis', {port: 6379}); //port number depends on your configuration
// define models
var Post = schema.define('Post', {
    title:     { type: String, length: 255 },
    content:   { type: Schema.Text },
    date:      { type: Date,    default: function () { return new Date;} },
    timestamp: { type: Number,  default: Date.now },
    published: { type: Boolean, default: false, index: true }
});

// simplier way to describe model
var User = schema.define('User', {
    name:         String,
    bio:          Schema.Text,
    approved:     Boolean,
    joinedAt:     Date,
    age:          Number
}, {
    restPath: '/users' // tell WebService adapter which path use as API endpoint
});

var Group = schema.define('Group', {name: String});

// define any custom method
User.prototype.getNameAndAge = function () {
    return this.name + ', ' + this.age;
};

// models also accessible in schema:
schema.models.User;
schema.models.Post;
```

SEE [schema(3)](http://jugglingdb.co/schema.3.html) for details schema usage.

```javascript
// setup relationships
User.hasMany(Post,   {as: 'posts',  foreignKey: 'userId'});
// creates instance methods:
// user.posts(conds)
// user.posts.build(data) // like new Post({userId: user.id});
// user.posts.create(data) // build and save

Post.belongsTo(User, {as: 'author', foreignKey: 'userId'});
// creates instance methods:
// post.author() -- getter when called with function
// post.author() -- sync getter when called without params
// post.author(user) -- setter when called with object

User.hasAndBelongsToMany('groups');
// user.groups().then() - get groups of user
// user.groups.create(data).then() - create new group and connect with user
// user.groups.add(group).then() - connect existing group with user
// user.groups.remove(group).then() - remove connection between group and user

schema.automigrate(); // required only for mysql and postgres NOTE: it will drop User and Post tables

// work with models:
var user = new User;
user.save().then(function() {
    var post = user.posts.build({title: 'Hello world'});
    post.save(console.log);
}, function(err){
    throw err;
});

// or just call it as function (with the same result):
var user = User();
user.save(...);

// Common API methods

// just instantiate model
new Post

// save model (of course async)
Post.create().then();

// all posts
Post.all().then()

// all posts by user
Post.all({where: {userId: user.id}, order: 'id', limit: 10, skip: 20}).then();

// the same as prev
user.posts().then()

// get one latest post
Post.findOne({where: {published: true}, order: 'date DESC'}).then();

// same as new Post({userId: user.id});
user.posts.build

// save as Post.create({userId: user.id}).then();
user.posts.create().then()

// find instance by id
User.find(1).then()

// count instances
User.count([conditions, ]).then()

// destroy instance
user.destroy().then();

// destroy all instances
User.destroyAll().then();

// update a post (currently only on the mysql adapter)
Post.update({ where:{id:'1'}, update:{ published:false }}).then();
```

SEE [model(3)](http://jugglingdb.co/model.3.html) for more information about
jugglingdb Model API. Or `man jugglingdb-model` in terminal.

```javascript

// Setup validations
User.validatesPresenceOf('name', 'email')
User.validatesLengthOf('password', {min: 5, message: {min: 'Password is too short'}});
User.validatesInclusionOf('gender', {in: ['male', 'female']});
User.validatesExclusionOf('domain', {in: ['www', 'billing', 'admin']});
User.validatesNumericalityOf('age', {int: true});
User.validatesUniquenessOf('email', {message: 'email is not unique'});

user.isValid().then(function () {
    // valid!
}, function(u){
    // not valid
    // u is ValidationError
        user.errors // hash of errors {attr: [errmessage, errmessage, ...], attr: ...}    
    // or u.codes
    // or u.obj.errors === user.errors they are the same
});

```

SEE ALSO [jugglingdb-validations(3)](http://jugglingdb.co/validations.3.html) or
`man jugglingdb-validations` in terminal. Validation tests: `./test/validations.test.js`

## Hooks

The following hooks supported:

* afterInitialize
* beforeCreate
* afterCreate
* beforeSave
* afterSave
* beforeUpdate
* afterUpdate
* beforeDestroy
* afterDestroy
* beforeValidate
* afterValidate

Each callback is class method of the model, it should accept single argument: `next`, this is callback which should
be called after end of the hook. Except `afterInitialize` because this method is syncronous (called after `new Model`).

During beforehooks the `next` callback accepts one argument, which is used to terminate flow. The argument passed on
as the `err` parameter to the API method callback.

## Object lifecycle:

```javascript
var user = new User;
// afterInitialize
user.save().then(); // If Model.id isn't set, save will invoke Model.create() instead

// beforeValidate
// afterValidate
// beforeSave
// beforeUpdate
// afterUpdate
// afterSave
// callback
user.updateAttribute('email', 'email@example.com').then();

// beforeValidate
// afterValidate
// beforeSave
// beforeUpdate
// afterUpdate
// afterSave
// callback
user.destroy().then();

// beforeDestroy
// afterDestroy
// callback

User.create(data).then();
// beforeValidate
// afterValidate
// beforeCreate
// beforeSave
// afterSave
// afterCreate
// callback
```

SEE [jugglingdb-hooks](http://jugglingdb.co/hooks.3.html) or type this command
in your fav terminal: `man jugglingdb-hooks`. Also check tests for usage
examples: `./test/hooks.test.js`

## Your own database adapter

To use custom adapter, pass it's package name as first argument to `Schema` constructor:

```javascript
    var mySchema = new Schema('mycouch', {host:.., port:...});
```

In that case your adapter should be named as 'jugglingdb-mycouch' npm package.

## Testing

Core of jugglingdb tests only basic features (database-agnostic) like
validations, hooks and runs db-specific tests using memory storage. It also
exports complete bucket of tests for external running. Each adapter should run
this bucket (example from `jugglingdb-redis`):

```javascript
// test/init.js
    var jdb = require('jugglingdb'),
Schema = jdb.Schema;

global.getSchema = function(){
    // ../ is your adapter path, assuming we are in /test/, and it's in your /lib/ folder
    return new Schema(require(__dirname + '/../lib'), {host: 'localhost', database: 1});
};
```

Each adapter could add specific tests to standart bucket:

```javascript
// adapter.test.js
describe('myadapter', function(){
    before(function(){
        // inject your global.getSchema
        require('./init.js');
    });

    // Call the common adapter tests (everything should pass)
    require('jugglingdb/test/common.batch.js');

    // the include.test.js contain relation tests that your adapter should pass
    require('jugglingdb/test/include.test.js');
    });
```

If you are using mocha, to run tests use this command (will search for files in the `test` directory by default):

```bash
mocha test/*.test.js
```

and to skip, for example `adapter` call mocha with `--grep`:

```bash
mocha --grep "^adapter*"
```

Before running make sure you've installed package (`npm install`) and if you
running some specific adapter tests, ensure you've configured database
correctly (host, port, username, password).

## Contributing

If you have found a bug please try to write unit test before reporting. Before
submit pull request make sure all tests still passed. Check
[roadmap](http://jugglingdb.co/roadmap.3.html), github issues if you want to
help. Contribution to docs highly appreciated. Contents of man pages and
http://jugglingdb.co generated from md files stored in this repo at `./docs` repo

## MIT License

```
    Copyright (C) 2011 by Anatoliy Chakkaev <mail [åt] anatoliy [døt] in>

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in
    all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    THE SOFTWARE.
```
