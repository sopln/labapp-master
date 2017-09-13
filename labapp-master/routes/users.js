var express = require('express');
var router = express.Router();
var async = require('async');
var schemas = require('../schemas');
var SSH2Shell = require ('ssh2shell');

/* GET users listing. */
router.get('/', function(req, res, next) {
  var db = req.db;
  var System = db.model('system', schemas.System);
  var userlist = [];
  System.find({}, function(err, docs) { 
    //nested async for loop design
    async.forEach(docs, function(doc, done) { 
      async.forEach(doc.users, function(user, cb) {
        console.log(user);
        grabUser(doc.ip, user, function(data) {
          userlist.push(data);
          cb();
        });
      }, function(err) {
        done();
      });
    }, function(err) {
      console.log(userlist);
      res.render('userlist', {'data': userlist});
    });
  });
});

//pass data onto callback as dict
function grabUser(ip, user, callback) {
  var host = {
    server:        {     
    host:         ip,
    userName:     "polytopia",
    password:     "m47h14b$",
  },
    commands:      [ "cat /etc/passwd | grep " + user,  "lsof -u " + user +" | wc -l", "id -G -n " + user, "who | grep " + user]
  };
  
  var SSH = new SSH2Shell(host);
  SSH.connect(function(stdout) {
      console.log("SSH user stdout!\r\n" + stdout);
      var data = {
        hostIP: ip,
        user: user, 
        cliIP: "", 
        loginAt: "", 
        homeDir: "", 
        shell: "",
        numFiles: 0, 
        groups: []
      };
      //cheap for loop hack - REFACTOR for async
      var cmdOn = -1;
      async.forEach(stdout.split('\r\n'), function(line, next) {
        //increment for each line before... eh disgusting
        if(line.includes("id -G -n") || line.includes("who | grep") || line.includes("lsof -u") || line.includes("cat /etc/passwd")){
          cmdOn++; //increment cmdOn when on line before command text
        } else if(cmdOn == 0) {  //cat /etc/passwd
          data.homeDir = line.split(":")[5];
          data.shell = line.split(":")[6];
        } else if(cmdOn == 1) { //lsof
          data.numFiles = parseInt(line);
        } else if(cmdOn == 2) { //id
          data.groups = line.split(' ');
        } else if(cmdOn == 3){ //who
          var splits = line.split(" ");
          data.loginAt = splits[splits.length-3];
          data.cliIP = splits[splits.length-1].replace(")", "").replace("(", ""); //also a cheap hack
          cmdOn++ //cheap hack - replace
        }
        next();
      }, function(err) {
        callback(data);
      });
  });
}

//function saveUser(data) {
//}

module.exports = router;
