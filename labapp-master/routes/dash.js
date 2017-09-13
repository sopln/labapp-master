var express = require('express');
var router = express.Router();
var core = require('../core');
var schemas = require('../schemas');

router.get('/', function(req, res, next) {
  var db = req.db;
  var System = db.model('system', schemas.System);
  System.find({}, function(err, docs){
    totalCpu = 0.0;
    totalFiles = 0;
    totalUsers = 0;
    console.log(docs);
    docs.forEach(function(doc){
      totalCpu += doc.cpu;
      if(doc.totalFiles != 'NaN')
        totalFiles += doc.openFiles;
      totalUsers += doc.users.length;
      //check if at end - stupid async cb's...
      console.log(doc);
      if (docs[docs.length-1] == doc){
        System.count({}, function(err, count){
          res.render('dash', {totalCpu: totalCpu, totalFiles: totalFiles, totalUsers: totalUsers, machinesUp:count});
        });
      }
    });
  });
});

module.exports = router
