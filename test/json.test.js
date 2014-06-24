var Schema = JDB.Schema;

describe('JSON property', function (){
  var schema, Model;

  it('should be defined', function (){
    schema = getSchema();
    Model = schema.define('Model', {propertyName: Schema.JSON});
    var m = new Model();
    expect('propertyName' in m).to.be(true);
    expect(m.propertyName).to.not.be.ok();
  });

  it('should accept JSON in constructor and return object', function (){
    var m = new Model({
      propertyName: '{"foo": "bar"}'
    });
    expect(m.propertyName).to.be.an('object');
    expect(m.propertyName.foo).to.equal('bar');
  });

  it('should accept object in setter and return object', function (){
    var m = new Model();
    m.propertyName = {'foo': 'bar'};
    expect(m.propertyName).to.be.an('object');
    expect(m.propertyName.foo).to.equal('bar');
  });

  it('should accept string in setter and return string', function (){
    var m = new Model();
    m.propertyName = '{"foo": "bar"}';
    expect(m.propertyName).to.be.a('string');
    expect(m.propertyName).to.equal('{"foo": "bar"}');
  });
});
