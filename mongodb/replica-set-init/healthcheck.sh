#!/bin/sh
set -eu

mongosh --host 127.0.0.1:27017 --quiet --eval '
const admin = db.getSiblingDB("admin");

try {
    rs.status();
} catch (error) {
    if (error.code !== 94 && error.codeName !== "NotYetInitialized") {
        print(`Replica set status error: ${error.message}`);
        quit(1);
    }

    print("Initializing replica set rs0...");

    const result = admin.runCommand({
        replSetInitiate: {
            _id: "rs0",
            members: [
                {
                    _id: 0,
                    host: "mongodb:27017"
                }
            ]
        }
    });

    if (result.ok !== 1) {
        print(`Replica set initialization failed: ${result.errmsg}`);
        quit(1);
    }
}

if (!admin.hello().isWritablePrimary) {
    quit(1);
}
'