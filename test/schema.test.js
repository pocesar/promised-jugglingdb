// This test written in mocha+should.js
var db = getSchema(), slave = getSchema(), Model, SlaveModel;

describe('schema', function (){

  before(function(){
    Model = db.define('Model');
  });

  it('should define Model', function (){
    expect(Model.schema).to.eql(db);
    var m = new Model();
    expect(m.schema).to.eql(db);
  });

  it('should clone existing model', function (){
    SlaveModel = slave.copyModel(Model);
    expect(SlaveModel.schema).to.eql(slave);
    expect(slave).to.not.eql(db);
    var sm = new SlaveModel();
    expect(sm).to.be.a(Model);
    expect(sm.schema).to.not.eql(db);
    expect(sm.schema).to.eql(slave);
  });

  it('should automigrate', function (done){
    db.automigrate().done(done);
  });

  it('should create transaction', function (done){
    var tr = db.transaction();
    expect(tr.connected).to.be(false);
    expect(tr.connecting).to.be(false);
    var called = false;
    tr.models.Model.create(new Array(3)).done(function (){
      called = true;
    });
    expect(tr.connected).to.be(false);
    expect(tr.connecting).to.be(true);

    db.models.Model.count().done(function(c){
      expect(c).to.equal(0);
      expect(called).to.be(false);

      tr.exec(function (){
        setTimeout(function (){
          expect(called).to.be(true);
          db.models.Model.count().done(function (c){
            expect(c).to.equal(3);
            done();
          }, function(){
            expect(function(){
              throw new Error('This should not be called');
            }).to.not.throwError();
          });
        }, 100);
      });
    }, function(){
      expect(function(){
        throw new Error('This should not be called');
      }).to.not.throwError();
    });
  });

});
