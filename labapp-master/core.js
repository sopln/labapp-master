
var ping = require('net-ping');
var SSH = require('simple-ssh');
const dns = require('dns');
var async = require('async');
var schema = require('./schemas')
//var exports = module.exports = {}
//exports and module.exports both point to the object returned from require()

//Commands to run on child servers
var userCMD = "sudo who -q | awk 'NR==1'";
var cpuCMD = 'sudo top -bn1 | grep "Cpu(s)" | ' + 
           'sed "s/.*, *\\([0-9.]*\\)%* id.*/\\1/" | ' + 
           "awk '{print 100 - $1\"%\"}'"; 
var diskSpaceCMD = "df -h | grep $(mount | sed -n '1p' | awk '{print $1}')";
var programmingVersCMD = "python -V; perl -v; go version; gcc -v; nodejs -v; npm -v; mongod --version; make -v; apt --version; bash --version; cpp --version; java -version; g++ --version"
fileCMD = 'sudo lsof -w | wc -l';

function getMachines(db, callback){
  var machines = {num: 0, up: []};
  var System = db.model('system', schema.System);
  System.find({}, function(err, docs){
    async.each(docs, function(machine, done) {
      isMachineUP(machine.ip, function(isUP) {
        if (isUP) {
          machines.num += 1;
          machines.up.push(machine.ip);
        } 
        done()
      });
    }, function(err) {
      console.log('Successfully got machines that are up, falling to ssh callback...');
      callback(machines)
    });
  });
}

function isMachineUP(ip, callback) {
  var session = ping.createSession();  
  session.pingHost(ip, function(error, ip){
    if(!error){
      callback(true);
    } else {
      callback(false);
    }
  });
}

//updates and checks ifUP, hostname and ip for system entry
exports.updateIPs = function(db) {
  var System = db.model('system', schema.System);
  System.find({}, function(err, docs){
   // var session = ping.createSession();
    docs.forEach(function(system) {
      //first check if there's an ip!
      //if(system.ip == "" ) {
        dns.resolve4(system.hostname, function(err, addrs) { //try and find an ip address that pings!
          if(err) next(err)
          console.log(addrs[0]);
          console.log("system");
          console.log(system);
          //i removed the error checking code... had to.
          System.update({_id: system._id}, {'ip': addrs[0]}, function(err, num){
            console.log(num);
          });
        });
     // } else {
       // session.pingHost(system.ip, function(error, host){
         // if(!error)
           // System.update({hostname: system.hostname}, {$set: {isUP: true}});
    });
  });
}

exports.doSSH = function(db) {
  var System = db.model('system', schema.System);
  getMachines(db, function(machines) {
    machines.up.forEach(function(ip) {
      var ssh = new SSH({
        host: ip, 
        user: 'polytopia', 
        pass: 'm47h14b$'
      });
      ssh.exec(userCMD, {
          pty: true,
  	  out: function(stdout) {
	    userCb(db, stdout, ip)
	  }
      }).exec(cpuCMD, {
        pty: true,
	out: function(stdout) {
	   cpuCb(db, stdout, ip)
	}
      }).exec(programmingVersCMD, {
        pty: true, 
        out: function(stdout) {
          versCb(db, stdout, ip)
        }
      }).exec(fileCMD, {
        pty: true, 
        out: function(stdout) {
          fileCb(db, stdout, ip);
        }
      }).start();
    });
  });
}


//each of these functions are callbacks that handle a response to a command over ssh then proccess it and post the results
function userCb(db, data, ip) {
  var fileCMD = data.replace('/ /g', ' -u ').replace('\r\n','');
  
  var System = db.model('system', schema.System);
  System.findOneAndUpdate({ip: ip}, {users: data.replace('\r\n', '').split(' ')}, function(err, doc){
    console.log("updating users: " + data);
  });
}

function cpuCb(db, data, ip){
  var System = db.model('system', schema.System);
  var cpu_s = data.replace('\r\n', '').replace('%', '');
  var cpu_i = parseFloat(cpu_s);
  System.findOneAndUpdate({ip: ip}, 
    {$push: {cpu: {value: cpu_i}} },
    {safe: true, upsert: true, new: true},function(err, doc) {
      console.log("updating cpu: " + cpu_i);
  });
}

function fileCb(db, data, ip){
  var System = db.model('system', schema.System);
  var oF = data.replace('\r\n', '');
  System.findOneAndUpdate({ip: ip}, 
    {$push: {openFiles: {value: oF}} }, 
    {safe: true, upsert: true, new: true}, function(err, doc) {
      console.log("updating files: " + data);
  });
}
 
function versCb(db, data, ip){
  var System = db.model('system', schema.System);
  var vers = {name: "", version: ""};
  async.forEach(data.split("\r\n"), function(line, cb) {
    if(line.includes("Python")) {
      vers.version = line.replace('\r\n', '').split(' ')[1];
      vers.name = "Python"; 
    } else if(line.includes("This is perl")){
      var regExp = /\(([^)]+)\)/;
      vers.name = "Perl";
      vers.version = regExp.exec(line)[1];
    } else if(line.includes("go version")) {
      var start = line.indexOf(".");
      vers.name = "Go";
      vers.version = line.substring(start-1, line.indexOf('linux')-1);
    } 
    cb();
  }, function(err) {
    console.log(vers); //TODO: what about if new version
    if(vers.name != "") { //this query doesn't add if version is already there
      System.findOneAndUpdate({ip: ip, "programmingVers.name" : {"$nin": [vers.name]}}, 
        {$push: {programmingVers: vers}},
        {safe: true, upsert: false, new: false},  function(err, doc) {
          console.log("updating versions: " + vers);
      });
    }
  });
}
