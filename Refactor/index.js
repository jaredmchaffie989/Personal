// Retrieve spreadsheet key and worksheet name.
// The spreadsheet key is the long string of alpha-numerics in the URL.
// Currently using the test mode api key for easypost
var keys = require("./config.json");
var fs = require("fs");

var GoogleSpreadsheet = require("google-spreadsheet");
var spreadsheet = new GoogleSpreadsheet(keys.spreadsheet_key);

// These are the creds for the service account to be used for OAuth. The desired
//	 spreadsheet must be shared with the email listed this file.
var creds = require("./google_creds.json");
var easypost = require('./node_modules/node-easypost')(keys.easypost_api_key);

// Google Account Authorization
// Wrapped this in a function so that it wouldn't auto-run during tests
module.exports.Start = function() { spreadsheet.useServiceAccountAuth(creds, function() {
	spreadsheet.getInfo(function(err, spreadsheet_info) {
		try {
			// Retrieve the shipping worksheet specified in keys.json
			var worksheet_index = getWorksheetIndexByName(keys.worksheet_name,
                                                          spreadsheet_info);

			if (worksheet_index == null)
				throw "Invalid Worksheet Name";

			var worksheet = spreadsheet_info.worksheets[worksheet_index];

			// Main loop
			worksheet.getRows(function(err, rows) {
				if (err)
					throw "Error retrieving rows";
				rows.forEach(function(row, i) {
					if (row.shpid) {
						// Just update the rates if an entry already exists
						if (row.action == 'REFRESH' || !row.action)
							updateShippingQuotes(row);

						// Purchase rates if all fields are marked
						if (row.action == 'PURCHASE' && row.shippingservice)
							purchasePostage(row, i);

						// If no shipping service provided, perform update instead
						if (row.action == 'PURCHASE' && !row.shippingservice)
							updateShippingQuotes(row);
					}
					// Create new entry
					if (row.action != 'INVALID' && row.action != 'SHIPPED') {
						// Create new address
						module.exports.createNewAddress(row).then(function(error) {
							logError(error, i + 2);
							row.action = 'INVALID';

							module.exports.updateTimestamp(row, function(stamped_row) {
								stamped_row.save();
							});
							return;
						},
						function(address) {
							// Create new shipment object for address
							return createNewShipment(worksheet, address, row);
						}).then(function(error) {
							logError(error, i + 2);
							row.action = 'INVALID';

							module.exports.updateTimestamp(row, function(stamped_row) {
								stamped_row.save();
							});
							return;
						},
						function(shipment) {
							if (row.action == 'UPDATE')
								row.action = 'REFRESH';
							// Set the rates bases on the shipment object
							return setInitialQuotes(worksheet, row, shipment);
						});
					}
				})
			});
		}

		// Write to the critical error log and stop the application
		catch(err) {
			var err_time = new Date();
			var message = "******************** ERROR - " + err_time.getFullYear() + "-" +
                           (err_time.getMonth() + 1) + "-" + err_time.getDate() + " " +
                           err_time.getHours() + ":" + err_time.getMinutes() + ":" +
                           err_time.getSeconds() + " ********************\n" + err +
                           "\n\n";
			fs.appendFileSync(keys.critical_log_path, message);
		}
	});
});}

// Creates a new address object with unique address ID
module.exports.createNewAddress = function(row) {
	return new Promise(function(reject, resolve) {
		// Convert the sheet row values into ones easyPost can recognize
		var cust_info = module.exports.convertSheetAddress(row);

		// Verify address
		easypost.Address.create(cust_info, function(err, cust_info) {
			cust_info.verify(function(err, response) {
				if (err)
					reject(Error('Address is invalid.'));
				else if (response.message !== undefined && response.message !== null)
					reject(Error(response.message));
				else
					resolve(response.address);
			});
		});
	});
}


// Create a new shipment based on the address object returned by createNewAddress
function createNewShipment(worksheet, address, row) {
	return new Promise(function(reject, resolve) {
		// Convert the package attributes into those easyPost can interpret
		var pack_info = module.exports.convertPackageInfo(row);

		// Create a new parcel object
		easypost.Parcel.create(pack_info, function(err, response) {
			if (err)
				reject(Error('Failed to create parcel object. Check dimensions.'));
			var parcel = response;

			easypost.Shipment.create({
				to_address: address,
				from_address: module.exports.getFromAddress(),
                parcel: parcel,
                carrier_accounts: ['ca_b656281632d44ee08b639209a4f9212c', // USPS
                                   'ca_24b16096ec46484094f37fb15dcbcb2d'], // UPS
				options: { label_format: 'ZPL' }
			}, function(err, shipment) {
				if (err)
					reject(Error('Failed to create a new shipment object.'));

				// Add the unique shipment id to Google Sheets
				row.shpid = shipment.id;

				resolve(shipment);
			});
		});
	});
}


// Converts the address provided in Google Sheets to one accepted by the easyPost API
module.exports.convertSheetAddress = function(row) {
	var residential = '';

	if (row.mi == '')
		var name = row.firstname.trim() + ' ' + row.lastname.trim();
	else
		var name = row.firstname.trim() + ' ' + row.mi.trim() + ' ' + row.lastname.trim();

	if (row.residentialyesnoblank.trim() == 'yes')
		residential = true;
	if (row.residentialyesnoblank.trim() == 'no')
		residential = false;

	return {
		'name': name,
		'company': row.company.trim(),
		'street1': row.address1.trim(),
		'street2': row.address2.trim(),
		'city': row.city.trim(),
		'state': row.stateprovince.trim(),
		'zip': row.zippostalcode.trim(),
		'country': row.countryiso3166.trim(),
		'residential': residential
	};
}


// Retrieve the return address specified in return_address.json
module.exports.getFromAddress = function() {
	return require("./return_address.json");
}


// Convert the parcel info provided in Google Sheets to one the easyPost API can accept
module.exports.convertPackageInfo = function(row) {
	// Determine if flat rate shipping must be calculated instead
	if (row.flatrateshipping.toLowerCase().replace(/\s/g, '') == 'regionalratea') {
		return {
			'length': row.l,
			'width': row.w,
			'height': row.h,
			'weight': row.weight,
			'predefined_package': 'RegionalRateBoxA'
		};
	}

	else if (row.flatrateshipping.toLowerCase().replace(/\s/g, '') == 'regionalrateb') {
		return {
			'length': row.l,
			'width': row.w,
			'height': row.h,
			'weight': row.weight,
			'predefined_package': 'RegionalRateBoxB'
		};
	}

	else {
		return {
			'length': row.l,
			'width': row.w,
			'height': row.h,
			'weight': row.weight
		};
	}
}


// Sets the initial rates for a new shipment
function setInitialQuotes(worksheet, row, shipment) {
	// Fetch flat rate shipping quotes and write them to the worksheet if specified
	//	under the length property
	if (shipment.parcel.predefined_package) {
		row.uspspriority = shipment.rates[0].rate;
		row.uspsparcelselect = undefined;
		row.uspsfirst = undefined;
		row.uspsexpress = undefined;
		row.upsground = undefined;
		row.ups3dayselect = undefined;
		row.ups2nddayairam = undefined;
		row.ups2nddayair = undefined;
		row.upsnextdayairsaver = undefined;
		row.upsnextdayairearlyam = undefined;
		row.upsnextdayair = undefined;

		module.exports.updateTimestamp(row, function(stamped_row) {
			stamped_row.save();
		});
	}

	// Fetch standard shipping quotes
	else {
		shipment.rates.forEach(function(shp_rate) {
			switch (shp_rate.service) {
				case 'ParcelSelect':
					row.uspsparcelselect = shp_rate.rate;
					break;
				case 'First':
					row.uspsfirst = shp_rate.rate;
					break;
				case 'Priority':
					row.uspspriority = shp_rate.rate;
					break;
				case 'Express':
					row.uspsexpress = shp_rate.rate;
					break;
				case 'Ground':
					row.upsground = shp_rate.rate;
					break;
				case '3DaySelect':
					row.ups3dayselect = shp_rate.rate;
					break;
				case '2ndDayAirAM':
					row.ups2nddayairam = shp_rate.rate;
					break;
				case '2ndDayAir':
					row.ups2nddayair = shp_rate.rate;
					break;
				case 'NextDayAirSaver':
					row.upsnextdayairsaver = shp_rate.rate;
					break;
				case 'NextDayAirEarlyAM':
					row.upsnextdayairearlyam = shp_rate.rate;
					break;
				case 'NextDayAir':
					row.upsnextdayair = shp_rate.rate;
					break;
			}
		})
		module.exports.updateTimestamp(row, function(stamped_row) {
			stamped_row.save();
		});
	}
}


// Update the shipping quotes without creating new address or shipment objects. Updates
//	based on the generated shp_id.
function updateShippingQuotes(row) {
	easypost.Shipment.retrieve(row.shpid, function(err, shipment) {
		// For flat rate shipping quotes
		if (shipment.parcel.predefined_package != null) {
			row.uspspriority = shipment.rates[0].rate;

			module.exports.updateTimestamp(row, function(stamped_row) {
				stamped_row.save();
			});
		}

		// For standard shipping quotes
		else {
			shipment.rates.forEach(function(shp_rate) {
				switch (shp_rate.service) {
					case 'ParcelSelect':
						row.uspsparcelselect = shp_rate.rate;
						break;
					case 'First':
						row.uspsfirst = shp_rate.rate;
						break;
					case 'Priority':
						row.uspspriority = shp_rate.rate;
						break;
					case 'Express':
						row.uspsexpress = shp_rate.rate;
						break;
					case 'Ground':
						row.upsground = shp_rate.rate;
						break;
					case '3DaySelect':
						row.ups3dayselect = shp_rate.rate;
						break;
					case '2ndDayAirAM':
						row.ups2nddayairam = shp_rate.rate;
						break;
					case '2ndDayAir':
						row.ups2nddayair = shp_rate.rate;
						break;
					case 'NextDayAirSaver':
						row.upsnextdayairsaver = shp_rate.rate;
						break;
					case 'NextDayAirEarlyAM':
						row.upsnextdayairearlyam = shp_rate.rate;
						break;
					case 'NextDayAir':
						row.upsnextdayair = shp_rate.rate;
						break;
				}
			})
			module.exports.updateTimestamp(row, function(stamped_row) {
				stamped_row.save();
			});
		}
	});
}


// Retrieves the worksheet index in case of multiple sheets. The name may be provided
// 	in keys.json.
function getWorksheetIndexByName(worksheet_name, spreadsheet_info) {
	for (var index = 0; index < spreadsheet_info.worksheets.length; index++) {
		if (spreadsheet_info.worksheets[index].title == worksheet_name)
			// Success
			return index;
	}
	// Failure
	return null;
}


// Updates the timestamp column
module.exports.updateTimestamp = function(row, callback) {
	var date = new Date();

	row.lastupdated = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" +
                      date.getDate() + " " +  date.getHours() + ":" + date.getMinutes() +
                      ":" + date.getSeconds();
	callback(row);
}


// Purchase postage for a given row if flagged
function purchasePostage(row, row_num) {
	// Retrieve shipment object by shp_id
	easypost.Shipment.retrieve(row.shpid, function(err, shipment) {
		// Retrieve the purchase rate based on chosen service
		getPurchaseRate(shipment, row).then(function(error) {
			logError(error, row_num + 2);
			row.action = 'INVALID';

			// Perform a final update on the quotes. Also addresses appending value
				//	bug when doing a standard save.
			updateShippingQuotes(row);
		},
		function(purchase_rate) {
			// Purchase the shipment. Generates associated label object.
			return shipment.buy({rate: purchase_rate}, function(err, shipment) {
				// Change the action flag so no further updates are made
				row.action = 'SHIPPED';
				row.zplurl = shipment.postage_label.label_url;
				row.tracking = shipment.tracker.tracking_code;

				// Perform a final update on the quotes. Also addresses appending value
				//	bug when doing a standard save.
				updateShippingQuotes(row);
			})
		});
	});
}


// Returns the rate object for the desired shipping service
function getPurchaseRate(shipment, row) {
	return new Promise(function(reject, resolve) {
		shipment.rates.forEach(function (purchase_rate, i) {
			if (row.shippingservice == (purchase_rate.carrier + ' ' +
										purchase_rate.service))
				resolve(purchase_rate);
			else {
				if (shipment.rates.length == i + 1)
					reject(Error('Selected service not available for purchase.'));
			}
		})
	});
}

// Non-blocking error logging for specific entries.
function logError(error, row_num) {
	if (error) {
		var err_time = new Date();
		var message = "******************** ERROR - " + err_time.getFullYear() + "-" +
                      (err_time.getMonth() + 1) + "-" + err_time.getDate() + " " +
                      err_time.getHours() + ":" + err_time.getMinutes() + ":" +
                      err_time.getSeconds() + " ********************\n" + "Row #: " +
                      row_num + " - " + error + "\n\n";

		fs.appendFileSync(keys.entry_log_path, message);
	}
}
