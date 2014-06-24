var db, Page;

var List = JDB.List;

describe('list', function (){

  before(function (){
    db = getSchema();
    Page = db.define('Page', function (m){
      m.property('widgets', []);
    });
  });

  it('should be exported to json just as "items"', function (){
    var p = new Page({widgets: ['hello']});
    expect(JSON.stringify(p)).to.equal(
      '{"widgets":[{"id":"hello"}]}'
    );
  });

  it('accepts JSON string as data', function(){
    var p = new Page('{"widgets":["hello"]}');
    expect(JSON.stringify(p)).to.equal('{"widgets":[{"id":"hello"}]}');
  });

  it('should throw an error on invalid JSON data', function(){
    expect(function(){
      new Page('{"widgets:"hello"]}');
    }).to.throwError();
  });

  it('should push and remove object', function (){
    var p = new Page({widgets: []});
    p.widgets.push(7);
    expect(JSON.stringify(p.widgets)).to.equal('[{"id":7}]');
    p.widgets.remove(7);
    expect(JSON.stringify(p.widgets)).to.equal('[]');
  });

  describe('#map', function (){

    it('should collect field', function (){
      var p = new Page({widgets: [
        {foo: 'bar'},
        {foo: 'baz'}
      ]});
      expect(p.widgets.map('foo')).to.eql(['bar', 'baz']);
    });

    it('should work as usual js array map', function (){
      var p = new Page({widgets: [
        {foo: 'bar'},
        {foo: 'baz'}
      ]});
      expect(p.widgets.map(function (x){
        return x.id;
      })).to.eql([1, 2]);
    });

  });

  describe('#find', function (){

    it('should find object', function (){
      var p = new Page({widgets: ['foo', 'bar', 'baz']});
      expect(JSON.stringify(
        p.widgets.find('foo')
      )).to.eql('{"id":"foo"}');
    });

    it('should find object by property', function (){
      var p = new Page({widgets: [
        {foo: 'bar'},
        {foo: 'baz'}
      ]});
      expect(JSON.stringify(
        p.widgets.find('bar', 'foo')
      )).to.eql('{"foo":"bar","id":1}');
    });

  });

  describe('#save', function () {

      it('should save itself to it\'s parent\'s parent', function () {
          var p = new Page({widgets: [{foo: 'bar'}, {foo: 'baz'}]});
          p.widgets.find('bar', 'foo').save();
      });

  });

  describe('list class itself', function(){
    var list;
    beforeEach(function(){
      list = new List([1,2,3]);
    });

    afterEach(function(){
      list = null;
    });

    it('should return the length', function(){
      expect(list.length).to.equal(3);
    });

    it('should accept JSON string data', function(){
      expect((new List('[1,2,3]')).length).to.equal(3);
    });

    it('should create list on invalid JSON string data', function(){
      expect((new List('[1,2,3')).length).to.equal(0);
    });

    it('should return the array on inspect', function(){
      expect(list.inspect()).to.eql('[ { id: 1 }, { id: 2 }, { id: 3 } ]');
    });

    it('should return JSON string on typecast', function(){
      expect('' + list).to.equal('[{"id":1},{"id":2},{"id":3}]');
    });

    it('should removeAt', function(){
      list.removeAt(0);
      expect(list.length).to.equal(2);
    });

    it('should remove objects by id', function(){
      list.push(9);
      list.remove({id: 9});
      expect(list.length).to.equal(3);
    });

    it('should execute callback from the object', function(done){
      list.push({'cb': done});
      list.map('cb');
    });
  });
});
