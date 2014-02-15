var db, Model;

describe('datatypes', function (){

  before(function (done){
    db = getSchema();
    Model = db.define('Model', {
      str : String,
      date: Date,
      num : Number,
      bool: Boolean,
      list: {type: []},
    });
    db.automigrate(function (){
      Model.destroyAll(done);
    });
  });

  it('should keep types when get read data from db', function (done){
    var d = new Date(), id;

    Model.create({
      str: 'hello', date: d, num: '3', bool: 1, list: ['test']
    }, function (err, m){
      expect(err).to.not.be.ok();
      expect(m.id).to.be.ok();
      expect(m.str).to.be.a('string');
      expect(m.num).to.be.a('number');
      expect(m.bool).to.be.a('boolean');
      id = m.id;
      testFind(testAll);
    });

    function testFind(next){
      Model.find(id, function (err, m){
        expect(err).to.not.be.ok();
        expect(m).to.be.ok();
        expect(m.str).to.be.a('string');
        expect(m.num).to.be.a('number');
        expect(m.bool).to.be.a('boolean');
        expect(m.date).to.be.a(Date);
        expect(m.date.toString()).to.equal(d.toString(), 'Time must match');
        next();
      });
    }

    function testAll(){
      Model.findOne(function (err, m){
        expect(err).to.not.be.ok();
        expect(m).to.be.ok();
        expect(m.str).to.be.a('string');
        expect(m.num).to.be.a('number');
        expect(m.bool).to.be.a('boolean');
        expect(m.date).to.be.a(Date);
        expect(m.date.toString()).to.equal(d.toString(), 'Time must match');
        done();
      });
    }

  });

  it('should convert "false" to false for boolean', function (){
    var m = new Model({bool: 'false'});
    expect(m.bool).to.equal(false);
  });

});
