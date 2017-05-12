Shipping Scripts:

1) index.js (node application for the easypost_google package)
2) label_printer.sh
3) archive_cleaner.sh


How to use easypost_google:

1) Primary application was designed to run as a cronjob, but may also be On-Demand. 
		(command = node index.js)
2) Update the config.json, google_creds.json, and return_address.json config files where 
		appropriate.
3) Create a line item that includes name, address, and package info
	a) Optional items include: MI, Company, Residential, Address2, Flat Rate Shipping.
	b) If flat rate shipping is selected, then only weight is required for package info.
	c) All other fields are handled by the application.
4) Once information is correctly entered and application is run, a shipping ID and list of
		quotes will be generated.
   a) If an invalid address or package info is provided, the row will be marked as 
   		'INVALID' and will be ignored until the Action column is manually updated.
4) Actions:
	a) <BLANK>/REFRESH - Generates AND updates the column's shipping quotes
	b) UPDATE - Generates a new shp_id and quotes if the row has been modified. If this 
		field is not changed upon revision, quotes will reflect the prior info.
	c) INVALID - Mark if you'd like the row to be ignored. Automatically flagged on 
		entry failure.
	d) PURCHASE - Purchases postage for the entry. Shipping Service is also a required
		field for this action. Will also generate a URL to the shipping label file (zpl 
		format) and a tracking #.
	e) SHIPPED - Automatically flagged upon successful PURCHASE. This entry will now be
		ignored.
5) Logging:
	a) Application blocking errors will be logged to critical.log
	b) Non-blocking entry errors will be logged to entries.log
	

How to use label_printer.sh:

1) Developed to run On-Demand. Configuration settings reside at the top of the script.
2) Labels must first be manually downloaded using the ZPL URL provided in the spreadsheet.
		Be sure that they are downloaded to the desired, label directory defined in the
		first line of the script.
3) Once all labels are in the label directory, simply run the script to print.
4) After each label is printed, the files will be moved to the archived labels directory 
		to be deleted at a later date.
		

How to use archive_cleaner.sh

1) Developed to run as a cronjob. Configuration settings reside at the top of the script.
2) The script will simply delete all labels in the dir that have passed the specified 
		retention age. 