#!/bin/sh
set -e

echo "Initializing MongoDB replica set..."

mongosh --host mongodb:27017 --quiet --eval '
const admin = db.getSiblingDB("admin");

try {
    const status = rs.status();

    if (status.ok === 1) {
        print("Replica set already initialized.");
    }
} catch (error) {
    print("Initializing replica set rs0...");

    rs.initiate({
        _id: "rs0",
        members: [
            {
                _id: 0,
                host: "mongodb:27017"
            }
        ]
    });
}
'

echo "Waiting for MongoDB primary..."

until mongosh \
    "mongodb://mongodb:27017/admin?replicaSet=rs0" \
    --quiet \
    --eval 'if (!db.hello().isWritablePrimary) quit(1)' \
    >/dev/null 2>&1
do
    sleep 2
done

echo "MongoDB replica set is ready."