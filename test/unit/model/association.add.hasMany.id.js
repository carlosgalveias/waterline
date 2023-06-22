var _ = require('lodash'),
    assert = require('assert'),
    belongsToFixture = require('../../support/fixtures/model/context.belongsTo.fixture'),
    Model = require('../../../lib/waterline/model');

describe('instance methods', function() {
  describe('hasMany association add', function() {

    describe('with an id', function() {

      /////////////////////////////////////////////////////
      // TEST SETUP
      ////////////////////////////////////////////////////

      var model;
      var i = 1;
      var container = { update: [], create: [] };
      var foo = _.cloneDeepWith(container);
      var bar = _.cloneDeepWith(container);

      before(function() {
        var fixture = belongsToFixture();

        var findOneFn = function(container) {

          var obj = function(criteria) {
            return this;
          };

          obj.prototype.exec = function(cb) {
            cb(null, [new model(container.update[0].values)]);
          };

          obj.prototype.populate = function() { return this; };

          return function(criteria) {
            return new obj(criteria);
          };
        };

        // Mock Collection Update Method
        var updateFn = function(container) {
          return function(criteria, values, cb) {
            var obj = {};
            obj.criteria = criteria;
            obj.values = values;
            container.update.push(obj);
            cb(null, [new model(values)]);
          };
        };

        // Mock Collection Create Method
        var createFn = function(container) {
          return function(values, cb) {
            var obj = { values: values };
            values.id = i;
            i++;
            container.create.push(obj);
            cb(null, new model(values));
          };
        };

        // Add Collection Methods to all fixture collections
        fixture.update = updateFn(foo);
        fixture.findOne = findOneFn(foo);
        fixture.waterline.collections.foo.update = updateFn(foo);
        fixture.waterline.collections.bar.update = updateFn(bar);
        fixture.waterline.collections.bar.create = createFn(bar);

        model = new Model(fixture, {});
      });


      /////////////////////////////////////////////////////
      // TEST METHODS
      ////////////////////////////////////////////////////

      it('should pass model values to create method for each relationship', function(done) {
        var person = new model({ id: 1, name: 'foobar' });

        person.bars.add(1);
        person.bars.add(2);

        person.save(function(err) {
          assert(bar.update.length === 2);
          assert(bar.update.length === 2);
          assert(bar.update[0].criteria.id === 1);

          assert(bar.update[0].values.foo);
          assert(bar.update[1].criteria.id === 2);
          assert(bar.update[1].values.foo);

          done();
        });
      });
    });

  });
});
