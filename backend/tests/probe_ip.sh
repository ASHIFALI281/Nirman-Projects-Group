#!/bin/bash
# Probe: which IP does client_ip() record through the ingress (with/without spoofed XFF)
API="$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)/api"
curl -s -X POST "$API/enquiries" -H 'Content-Type: application/json' -d '{"name":"TEST_Probe1","phone":"9876543210","message":"probe ip one"}'; echo
curl -s -X POST "$API/enquiries" -H 'Content-Type: application/json' -H 'X-Forwarded-For: 1.2.3.4' -d '{"name":"TEST_Probe2","phone":"9876543210","message":"probe ip two"}'; echo
mongosh --quiet test_database --eval 'printjson(db.enquiries.find({name:/^TEST_Probe/},{name:1,ip:1}).toArray())'
