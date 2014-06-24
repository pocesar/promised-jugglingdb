var files;

module.exports = files = {
  utils: require('./utils'),
  List: require('./list'),
  AbstractClass: require('./model'),
  Include: require('./include'),
  Schema: require('./schema'),
  Scope: require('./scope'),
  Relations: require('./relations'),
  Hooks: require('./hooks'),
  Validations: require('./validations')
};

for(var file in files) {
  files[file] = files[file](files);
}