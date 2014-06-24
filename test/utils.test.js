var utils = JDB.utils;

describe('utils', function (){
  describe('curry', function (){
    it('should bind to the object context', function (){
      var obj = {
        count: 0,
        countUp: function(){
          this.count++;
        }
      };
      var count = utils.curry(obj.countUp, obj);
      count();
      expect(obj.count).to.be(1);

      obj = {
        test: 1,
        ok: true,
        k: 'k'
      };

      Object.keys(obj).forEach(utils.curry(function(key){
        expect(this[key]).to.equal(obj[key]);
      }, obj));
    });
  });

  describe('curryArgs', function (){
    it('should bind to the object context with predefined arguments', function (){
      var obj = {
        count: 0,
        add: function(pre, pos){
          this.count += pre + pos;
        }
      };
      var count = utils.curryArgs(obj.add, obj, 2);
      count(2);
      expect(obj.count).to.equal(4);
    });
  });

  describe('hiddenProperty', function (){
    it('should define a hidden property', function (){
      var obj = {nothidden: true};
      utils.hiddenProperty(obj, 'hidden', true);

      expect(Object.keys(obj)).to.have.length(1);
      expect(Object.getOwnPropertyNames(obj)).to.have.length(2);
      expect(obj).to.eql({nothidden:true});
    });
  });

  describe('defineReadonlyProp', function (){
    it('it should not allow changing the values', function (){
      'use strict';

      var obj = {};
      utils.defineReadonlyProp(obj, 'readonly', 1);
      expect(obj.readonly).to.equal(1);
      try {
        obj.readonly = 2;
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      } catch (e) {
        expect(e).to.be.a(TypeError);
      }
      try {
        delete obj.readonly;
        expect(function(){
          throw new Error('This should not be called');
        }).to.not.throwError();
      } catch (e) {
        expect(e).to.be.a(TypeError);
      }
      expect(obj.readonly).to.equal(1);
    });
  });

  describe('promises', function (){
    it('should return library', function (done){
      var deferred = utils.Promise.defer();

      deferred.promise.done(function(value){
        expect(value).to.equal(true);
        done();
      });

      deferred.resolve(true);
    });
  });
});