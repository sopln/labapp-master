var mongoose = require('mongoose');
var schema = mongoose.Schema; 

var subDat = schema({
 time: {type: String, default: Date.now()},
 value: String
},{_id:false});


exports.System = schema({
  admin: String, 
  adminPass: String, 
  flags: String, 
  hostname: String, 
  ip: String, 
  isUp: Boolean, 
  lastCheck: Number, 
  name: String, 
  os: String, 
  users: [String], 
  cpu: [subDat],
  openFiles: [subDat],
  programmingVers: [
    {name: String, version: String}
  ] 
});

exports.Stat = schema({
  cpu: Number, 
  ip: String,
  openFiles: Number, 
  users: [String]
});

