const archiveDir = "./labels/archive_labels/";

// Measured in days
const retention = 30;
const fs = require('fs');
const now = new Date().getTime();
// 86400000 ms in a day
var expired = now - (retention * 86400000);

fs.readdir(archiveDir, (err, files) => {
  	files.forEach(file => {
  		var fullPath = archiveDir + file;
		var fileStats = fs.statSync(fullPath);
		// Get the last-modified date
  		var modifiedTime = new Date(fileStats.mtime);

  		if (modifiedTime <= expired) {
  			return fs.unlink(fullPath, function(err) {
        		if (err) {
            		return console.error(err);
          		}
          	console.log('Successfully deleted ' + file);
          	});
        }
  	});
});
