// This test written in mocha+should.js
var db, Book, Chapter, Author, Reader;

describe('relations', function (){
  before(function (done){
    db = getSchema();
    Book = db.define('Book', {name: String});
    Chapter = db.define('Chapter', {name: {type: String, index: true, limit: 20}});
    Author = db.define('Author', {name: String});
    Reader = db.define('Reader', {name: String});

    db.automigrate().then(function (){
      return Book.destroyAll();
    }).then(function (){
      return Chapter.destroyAll();
    }).then(function (){
      return Author.destroyAll();
    }).then(function (){
      return Reader.destroyAll();
    }).done(done);
  });

  after(function (done){
    db.disconnect().done(done);
  });

  describe('hasMany', function (){
    it('can be declared in different ways', function (done){
      Book.hasMany(Chapter);
      Book.hasMany(Reader, {as: 'users'});
      Book.hasMany(Author, {foreignKey: 'projectId'});
      var b = new Book();
      expect(b.chapters).to.be.a('function');
      expect(b.users).to.be.a('function');
      expect(b.authors).to.be.a('function');
      expect(Object.keys((new Chapter()).toObject())).to.contain('bookId');
      expect(Object.keys((new Author()).toObject())).to.contain('projectId');

      db.automigrate().done(done);
    });

    it('can be declared in short form', function (done){
      Author.hasMany('readers');
      expect((new Author()).readers).to.be.a('function');
      expect(Object.keys((new Reader()).toObject())).to.contain('authorId');

      db.autoupdate().done(done);
    });

    it('should build record on scope', function (done){
      Book.create(function (err, book){
        var c = book.chapters.build();
        expect(c.bookId).to.equal(book.id);
        c.save().done(function(){
          done();
        });
      });
    });

    it('should create record on scope', function (done){
      var book;
      Book.create()
      .then(function (b){
        book = b;
        return book.chapters.create();
      }).then(function (c){
        expect(c).to.be.ok();
        expect(c.bookId).to.equal(book.id);
      }, function(){
        expect(function(){
          throw new Error('Should not error');
        }).to.not.throwError();
      }).done(done);
    });

    it('should fetch all scoped instances', function (done){
      Book.create()
      .bind({})
      .then(function (book){
        this.book = book;
        return book.chapters.create({name: 'a'});
      }).then(function (chapter){
        expect(chapter.name).to.be('a');
        return this.book.chapters.create({name: 'z'});
      }).then(function (chapter){
        expect(chapter.name).to.be('z');
        return this.book.chapters.create({name: 'c'});
      }).then(function (chapter){
        expect(chapter.name).to.be('c');
        fetch(this.book);
      });

      function fetch(book){
        var ch;
        book.chapters().then(function (_ch){
          ch = _ch;
          expect(ch).to.be.ok();
          expect(ch).to.have.length(3);

          return book.chapters({order: 'name DESC'});
        }).then(function (c){
          expect(ch).to.be.ok();
          expect(c.shift().name).to.equal('z');
          expect(c.pop().name).to.equal('a');
        }).done(done);
      }
    });

    it('should find scoped record', function (done){
      var id;

      Book.create()
      .bind({})
      .then(function (book){
        this.book = book;
        return book.chapters.create({name: 'a'});
      }).then(function (ch){
        id = ch.id;
        return this.book.chapters.create({name: 'z'});
      }).then(function (){
        return this.book.chapters.create({name: 'c'});
      }).then(function (){
        fetch(this.book);
      });

      function fetch(book){
        book.chapters.find(id)
        .then(function (ch){
          expect(ch).to.be.ok();
          expect(ch.id).to.equal(id);
        }).done(done);
      }
    });

    it('should destroy scoped record', function (done){
      Book.create()
      .bind({})
      .then(function (book){
        this.book = book;
        return book.chapters.create({name: 'a'});
      }).then(function (ch){
        this.ch = ch;
        return this.book.chapters.destroy(ch.id);
      }).then(function (){
        return this.book.chapters.find(this.ch.id);
      }).catch(function (err){
        expect(err).to.be.ok();
        expect(err.message).to.equal('Not found');
      }).done(function(){
        done();
      });
    });

    it('should not allow destroy not scoped records', function (done){
      Book.create()
      .bind({})
      .then(function (book1){
        this.book1 = book1;
        return book1.chapters.create({name: 'a'});
      }).then(function (ch){
        this.ch = ch;
        return Book.create();
      }).then(function(book2){
        this.book2 = book2;
        return book2.chapters.destroy(this.ch.id);
      }).catch(function (err){
        expect(err).to.be.ok();
        expect(err.message).to.equal('Permission denied');
        return this.book1.chapters.find(this.ch.id);
      }).then(function (ch){
        expect(ch).to.be.ok();
        expect(ch.id).to.equal(this.ch.id);
      }).done(done);
    });
  });

  describe('belongsTo', function (){
    var List, Item, Fear, Mind;

    it('can be declared in different ways', function (){
      List = db.define('List', {name: String});
      Item = db.define('Item', {name: String});
      Fear = db.define('Fear');
      Mind = db.define('Mind');

      // syntax 1 (old)
      Item.belongsTo(List);
      expect(Object.keys((new Item()).toObject())).to.contain('listId');
      expect((new Item()).list).to.be.a('function');

      // syntax 2 (new)
      Fear.belongsTo('mind');
      expect(Object.keys((new Fear()).toObject())).to.contain('mindId');
      expect((new Fear()).mind).to.be.a('function');
      // (new Fear).mind.build().should.be.an.instanceOf(Mind);
    });

    it('can be used to query data', function (done){
      List.hasMany('todos', {model: Item});
      var todo;

      db.automigrate().then(function (){
        return List.create();
      }).then(function (list){
        expect(list).to.be.ok();
        return list.todos.create();
      }).then(function (_todo){
        todo = _todo;
        return todo.list();
      }).then(function (l){
        expect(l).to.be.ok();
        expect(l).to.be.a(List);
      }).done(done);
    });

    it('could accept objects when creating on scope', function (done){
      var list;
      List.create().then(function (_list){
        list = _list;
        expect(list).to.be.ok();
        return Item.create({list: list});
      }).then(function (item){
        expect(item).to.be.ok();
        expect(item.listId).to.be.ok();
        expect(item.listId).to.equal(list.id);
        expect(item.__cachedRelations.list).to.equal(list);
      }).done(done);
    });

  });

  describe('hasAndBelongsToMany', function (){
    var Article, Tag, ArticleTag;

    before(function(){
      Article = db.define('Article', {title: String});
      Tag = db.define('Tag', {name: String});
      Article.hasAndBelongsToMany('tags');
      ArticleTag = db.models.ArticleTag;
    });

    it('can be declared', function (done){
      db.automigrate().then(function (){
        return Article.destroyAll();
      }).then(function (){
        return Tag.destroyAll();
      }).then(function (){
        return ArticleTag.destroyAll();
      }).done(done);
    });

    it('should allow to create instances on scope', function (done){
      var t, article;
      Article.create().then(function (_article){
        article = _article;
        return article.tags.create({name: 'popular'});
      }).then(function (_t){
        t = _t;
        expect(t).to.be.a(Tag);
        return ArticleTag.findOne();
      }).then(function (at){
        expect(at).to.be.ok();
        expect(at.tagId.toString()).to.equal(t.id.toString());
        expect(at.articleId.toString()).to.equal(article.id.toString());
      }).done(done);
    });

    it('should allow to fetch scoped instances', function (done){
      Article.findOne()
      .then(function (article){
        return article.tags();
      }).then(function (tags){
          expect(tags).to.be.ok();
      }).done(done);
    });

    it('should allow to add connection with instance', function (done){
      var article, tag;
      Article.findOne().then(function (_article){
        article = _article;
        return Tag.create({name: 'awesome'});
      }).then(function (_tag){
        tag = _tag;
        return article.tags.add(tag);
      }).then(function (at){
        expect(at).to.be.ok();
        expect(at).to.be.a(ArticleTag);
        expect(at.tagId).to.equal(tag.id);
        expect(at.articleId).to.equal(article.id);
      }).done(done);
    });

    it('should allow to remove connection with instance', function (done){
      var article, tags, len;
      Article.findOne().then(function (_article){
        article = _article;
        return article.tags();
      }).then(function (_tags){
        tags = _tags;
        len = tags.length;
        expect(tags).to.not.be.empty();
        expect(tags[0]).to.be.ok();
        return article.tags.remove(tags[0]);
      }).then(function (){
        return article.tags(true);
      }).then(function (_tags){
        expect(_tags).to.have.length(len - 1);
      }).done(done);
    });

    it('should remove the correct connection', function (done){
      Article
      .create({title: 'Article 1'})
      .bind({})
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
      .done(function(tags){
          expect(tags[0].name).to.be('correct');
          done();
      });
    });

  });

});
