ARCHIVE_DIR="./labels/archive_labels/"
# Measured in days
RETENTION=30

find $ARCHIVE_DIR -type f -mtime +$RETENTION -delete

unset ARCHIVE_DIR