var tap = require('tap');
var ship = require('../index.js');

function Row() {
	this.firstname = 'John';
	this.lastname = 'Doe';
	this.mi = '';
	this.residentialyesnoblank = 'yes';
	this.company = '';
	this.address1 = '123 Fake Street';
	this.address2 = '';
	this.city = 'Austin';
	this.stateprovince = 'TX';
	this.zippostalcode = '78745';
	this.countryiso3166 = 'US';
	this.l = 5;
	this.w = 12;
	this.h = 4;
	this.weight = 16;
	this.flatrateshipping = '';
	this.lastupdated = false;
}

/************************************
Test: convertSheetAddress(row)
************************************/
var row = new Row();
var conversion = ship.convertSheetAddress(row);

tap.equal(conversion.name, 'John Doe');
tap.equal(conversion.company, '');
tap.equal(conversion.street1, '123 Fake Street');
tap.equal(conversion.street2, '');
tap.equal(conversion.city, 'Austin');
tap.equal(conversion.state, 'TX');
tap.equal(conversion.zip, '78745');
tap.equal(conversion.country, 'US');
tap.ok(conversion.residential);

// Hit the else statements for coverage
row.residentialyesnoblank = 'no';
row.mi = 'Nixon';
conversion = ship.convertSheetAddress(row);

tap.equal(conversion.name, 'John Nixon Doe');
tap.notOk(conversion.residential);

/************************************
Test: getFromAddress()
************************************/
var fromAddress = ship.getFromAddress();

tap.equal(fromAddress.id, '');
tap.equal(fromAddress.name, '');
tap.equal(fromAddress.company, 'WigWag');
tap.equal(fromAddress.street1, '4009 Banister Lane');
tap.equal(fromAddress.street2, 'Suite 200');
tap.equal(fromAddress.city, 'Austin');
tap.equal(fromAddress.state, 'TX');
tap.equal(fromAddress.zip, '78749');
tap.equal(fromAddress.country, 'US');

/************************************
Test: convertPackageInfo(row)
************************************/
var packageInfo = ship.convertPackageInfo(row);

// Test standard dimensions
tap.equal(packageInfo.length, 5);
tap.equal(packageInfo.width, 12);
tap.equal(packageInfo.height, 4);
tap.equal(packageInfo.weight, 16);

// Test flat rate A
row.flatrateshipping = 'regionalrateA';
packageInfo = ship.convertPackageInfo(row);

tap.equal(packageInfo.length, 5);
tap.equal(packageInfo.width, 12);
tap.equal(packageInfo.height, 4);
tap.equal(packageInfo.weight, 16);
tap.equal(packageInfo.predefined_package, 'RegionalRateBoxA');

// Test flat rate B
row.flatrateshipping = 'regionalrateB';
packageInfo = ship.convertPackageInfo(row);

tap.equal(packageInfo.length, 5);
tap.equal(packageInfo.width, 12);
tap.equal(packageInfo.height, 4);
tap.equal(packageInfo.weight, 16);
tap.equal(packageInfo.predefined_package, 'RegionalRateBoxB');

/************************************
Test: updateTimestamp(row)
************************************/

// This function determines the current time on the fly, so we can't compare to a baseline
//   here. Instead, we'll just check that the field gets set after initialized to false.
tap.notOk(row.lastupdated);

ship.updateTimestamp(row, function() {
	tap.ok(row.lastupdated);
});

/************************************
Test: createNewAddress(row)
************************************/
var address = ship.createNewAddress(row);
// The result is interpreted as a pending promise. Not sure how to parse the response.
//   This also holds true for the createShipment function.
tap.type(address, Promise);

// All other functions require the setup and authentication of google worksheets as
//	arguments, which oversteps the scope of this assessment.



