// Constants
const labelDir = "./labels/";
var archiveDir = "./labels/archive_labels/";
const printerIp = "10.10.102.100";
const printerPort = "9100";

var fs = require('fs');
var Netcat = require('node-netcat');

var client = new Netcat.client(printerPort, printerIp, timeout = 1);

client.start();

// Cycle through zpl files, printing and archive them to separate directory for deletion
fs.readdir(labelDir, (err, files) => {
  	files.forEach(file => {
  		var fileStats = fs.statSync(labelDir + file);
  		if (fileStats.isFile()) {
			client.send(fs.readFileSync(labelDir + file, 'utf8'));
			console.log("Printing label " + file);
			fs.renameSync(labelDir + file, archiveDir + file);
		}
  	});
  	// Close the connection
  	client.send('', true);
});


