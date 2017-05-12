#!/bin/sh

# Constants
LABEL_DIR="./labels/"
ARCHIVE_DIR="./labels/archive_labels/"
PRINTER_IP="10.10.102.100"
PRINTER_PORT=9100

shopt -s nullglob
# Cycle through zpl files, printing and archive them to separate directory for deletion
for f in $LABEL_DIR*.zpl; do
	cat $f | nc $PRINTER_IP $PRINTER_PORT
	echo "Printing label $f"
	mv $f $ARCHIVE_DIR
done

unset LABEL_DIR
unset ARCHIVE_DIR
unset PRINTER_IP
unset PRINTER_PORT
