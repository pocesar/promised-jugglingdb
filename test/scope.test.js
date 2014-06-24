var db, Railway, Station;

describe('scope', function (){

  before(function (){
    db = getSchema();
    Railway = db.define('Railway', {
      URID: {type: String, index: true}
    });
    Station = db.define('Station', {
      USID        : {type: String, index: true},
      capacity    : {type: Number, index: true},
      thoughput   : {type: Number, index: true},
      isActive    : {type: Boolean, index: true},
      isUndeground: {type: Boolean, index: true}
    });
  });

  beforeEach(function (done){
    Railway.destroyAll().then(function (){
      return Station.destroyAll();
    }).done(done);
  });

  it('should define scope with query', function (done){
    Station.scope('active', {where: {isActive: true}});
    Station.active
    .create()
    .then(function (station){
      expect(station).to.be.ok();
      expect(station.isActive).to.be.ok();
      expect(station.isActive).to.be(true);
    }).done(done);
  });

  it('should allow scope chaining', function (done){
    Station.scope('active', {where: {isActive: true}});
    Station.scope('subway', {where: {isUndeground: true}});

    Station.active.subway
    .create()
    .then(function (station){
      expect(station).to.be.ok();
      expect(station.isActive).to.be(true);
      expect(station.isUndeground).to.be(true);
    }).done(done);
  });

  it('should query all', function (done){
    Station.scope('active', {where: {isActive: true}});
    Station.scope('inactive', {where: {isActive: false}});
    Station.scope('ground', {where: {isUndeground: true}});

    Station.active.ground.create()
    .then(function (){
      return Station.inactive.ground.create();
    }).then(function (){
      return Station.ground.inactive();
    }).then(function(ss){
      expect(ss).to.have.length(1);
    }).done(done);
  });

  it('should destroy all', function (done){
    Station.inactive.ground.create()
    .then(function (){
      return Station.inactive();
    }).then(function (ss){
      expect(ss).to.have.length(1);
      return Station.inactive.destroyAll();
    }).then(function (){
      return Station.inactive(true);
    }).then(function (ss){
      expect(ss).to.have.length(0);
    }).done(done);
  });
});
