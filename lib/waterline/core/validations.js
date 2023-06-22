/**
 * Handles validation on a model
 *
 * Uses Anchor for validating
 * https://github.com/balderdashy/anchor
 */

var _ = require('lodash');
var anchor = require('anchor');
var async = require('async');
var utils = require('../utils/helpers');
var hasOwnProperty = utils.object.hasOwnProperty;
var WLValidationError = require('../error/WLValidationError');
var rules = require('anchor/accessible/rules');
console.log(rules)
/**
 * Build up validations using the Anchor module.
 *
 * @param {String} adapter
 */

var Validator = module.exports = function(adapter) {
  this.validations = {};
};

/**
 * Builds a Validation Object from a normalized attributes
 * object.
 *
 * Loops through an attributes object to build a validation object
 * containing attribute name as key and a series of validations that
 * are run on each model. Skips over type and defaultsTo as they are
 * schema properties.
 *
 * Example:
 *
 * attributes: {
 *   name: {
 *     type: 'string',
 *     length: { min: 2, max: 5 }
 *   }
 *   email: {
 *     type: 'string',
 *     required: true
 *   }
 * }
 *
 * Returns: {
 *   name: { length: { min:2, max: 5 }},
 *   email: { required: true }
 * }
 */

Validator.prototype.initialize = function(attrs, types, defaults) {
  var self = this;

  defaults = defaults || {};

  // These properties are reserved and may not be used as validations
  this.reservedProperties = [
    'defaultsTo',
    'primaryKey',
    'autoIncrement',
    'unique',
    'index',
    'collection',
    'dominant',
    'through',
    'columnName',
    'foreignKey',
    'references',
    'on',
    'groupKey',
    'model',
    'via',
    'size',
    'example',
    'validationMessage',
    'validations',
    'populateSettings',
    'onKey',
    'protected',
    'meta'
  ];


  if (defaults.ignoreProperties && Array.isArray(defaults.ignoreProperties)) {
    this.reservedProperties = this.reservedProperties.concat(defaults.ignoreProperties);
  }

  // Add custom type definitions to anchor
  types = types || {};
  //anchor.define(types);

  Object.keys(attrs).forEach(function(attr) {
    self.validations[attr] = {};

    Object.keys(attrs[attr]).forEach(function(prop) {

      // Ignore null values
      if (attrs[attr][prop] === null) { return; }

      // If property is reserved don't do anything with it
      if (self.reservedProperties.indexOf(prop) > -1) { return; }

      // use the Anchor `in` method for enums
      if (prop === 'enum') {
        self.validations[attr]['in'] = attrs[attr][prop];
        return;
      }

      self.validations[attr][prop] = attrs[attr][prop];
    });
  });
};


/**
 * Validator.prototype.validate()
 *
 * Accepts a dictionary of values and validates them against
 * the validation rules expected by this schema (`this.validations`).
 * Validation is performed using Anchor.
 *
 *
 * @param {Dictionary} values
 *        The dictionary of values to validate.
 *
 * @param {Boolean|String|String[]} presentOnly
 *        only validate present values (if `true`) or validate the
 *        specified attribute(s).
 *
 * @param {Function} callback
 *        @param {Error} err - a fatal error, if relevant.
 *        @param {Array} invalidAttributes - an array of errors
 */

Validator.prototype.validate = function(values, presentOnly, cb) {
  var self = this;
  var errors = {};
  var validations = Object.keys(this.validations);

  // Handle optional second arg AND Use present values only, specified values, or all validations
  /* eslint-disable no-fallthrough */
  switch (typeof presentOnly) {
    case 'function':
      cb = presentOnly;
      break;
    case 'string':
      validations = [presentOnly];
      break;
    case 'object':
      if (Array.isArray(presentOnly)) {
        validations = presentOnly;
        break;
      } // Fall through to the default if the object is not an array
    default:
      // Any other truthy value.
      if (presentOnly) {
        validations = _.intersection(validations, Object.keys(values));
      }
      /* eslint-enable no-fallthrough */
  }


  // Validate all validations in parallel
  async.each(validations, function _eachValidation(validation, cb) {
    var curValidation = self.validations[validation];
    console.log({ curValidation, validation, value: values[validation] })
    if(!curValidation){
      return cb('Weird validation ', curValidation)
    }
    var rule;
    switch (curValidation.type) {
      case 'email':
        rule = {isEmail: true};
        break;
      case 'boolean':
        rule = { isBoolean: true };
        break;
      case 'number':
      case 'integer':
      case 'float':
        rule = { isNumber: true };
        break;
      case 'json':
      case 'string':
        rule = { isString: true };
        break;
      default:
        cb('dont know what to do with ' + curValidation.type)
    }
    const other = _.cloneDeepWith(curValidation);
    if (other.in) {
      other.isIn = other.in
    }
    delete other.type;
    delete other.required;
    delete other.in;
    delete other.equals;
    delete other.contains;
    delete other.special;
    if(other.contains){
      rule = other.contains
    }else{
    Object.assign(rule, other);
    console.log({ rule })
    }
    // Build Requirements
    var requirements;
    try {
      requirements = anchor(values[validation], rule);

    } catch (e) {
      console.error(e)
      // Handle fatal error:
      return cb(e);
    }
    requirements = _.cloneDeepWith(requirements);
    console.log({ requirements })
    // Grab value and set to null if undefined
    var value = values[validation];
    if (typeof value == 'undefined') {
      value = null;
    }

    // If value is not required and empty then don't
    // try and validate it
    if (!curValidation.required) {
      if (value === null || value === '') {
        return cb();
      }
    }

    // If Boolean and required manually check
    if (curValidation.required && curValidation.type === 'boolean' && (typeof value !== 'undefined' && value !== null)) {
      if (value.toString() === 'true' || value.toString() === 'false') {
        return cb();
      }
    }

    // If type is integer and the value matches a mongoID let it validate
    if (hasOwnProperty(self.validations[validation], 'type') && self.validations[validation].type === 'integer') {
      if (utils.matchMongoId(value)) {
        return cb();
      }
    }

    if (requirements && requirements.length) {
      console.log('validation false', requirements)
      errors[validation] = requirements;
      validationError = requirements;
      validationError.type = values[validation];
      console.log({validationError})
      return cb(null, validationError);
    }
    console.log('validation true')
    return cb();
    // Rule values may be specified as sync or async functions.
    // Call them and replace the rule value with the function's result
    // before running validations.
    async.each(requirements, function _eachKey(key, next) {
      try {
        if (typeof requirements[key] !== 'function') {
          return next();
        }

        // Run synchronous function
        if (requirements[key].length < 1) {
          requirements[key] = requirements[key].apply(values, []);
          return next();
        }

        // Run async function
        requirements[key].call(values, function(result) {
          requirements[key] = result;
          next();
        });
      } catch (e) {
        return next(e);
      }
    },
    function afterwards(unexpectedErr) {
      if (unexpectedErr) {
        // Handle fatal error
        return cb(unexpectedErr);
      }

      // If the value has a dynamic required function and it evaluates to false lets look and see
      // if the value supplied is null or undefined. If so then we don't need to check anything. This
      // prevents type errors like `undefined` should be a string.
      // if required is set to 'false', don't enforce as required rule
      if (requirements.hasOwnProperty('required') && !requirements.required) {
        if (_.isNull(value)) {
          return cb();
        }
      }

      // Now run the validations using Anchor.
      var validationError;
      try {
        // validationError = anchor(rules, value).to(requirements, values);
      } catch (e) {
        // Handle fatal error:
        return cb(e);
      }

      // If no validation errors, bail.
      if (!validationError) {
        return cb();
      }

      // Build an array of errors.
      errors[validation] = [];

      validationError.forEach(function(obj) {
        if (obj.property) {
          delete obj.property;
        }
        errors[validation].push({ rule: obj.rule, message: obj.message });
      });

      return cb();
    });

  }, function allValidationsChecked(err) {
    // Handle fatal error:
    if (err) {
      return cb(err);
    }


    if (Object.keys(errors).length === 0) {
      return cb();
    }
    console.log({errors})
    return cb(undefined, errors);
  });

};
