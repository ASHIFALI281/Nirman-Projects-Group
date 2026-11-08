#!/bin/bash
# Probe: explicit null on company tagline / application status / enquiry admin_notes (restores immediately)
API="$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)/api"
source <(grep -E '^ADMIN_(EMAIL|PASSWORD)=' /app/backend/.env)
J=/tmp/cj.txt
curl -s -c $J -X POST "$API/auth/login" -H 'Content-Type: application/json' -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" -o /dev/null
ORIG=$(mongosh --quiet test_database --eval 'print(db.company_info.findOne({key:"company"}).tagline)')
echo "company PUT tagline:null -> $(curl -s -o /dev/null -w '%{http_code}' -b $J -X PUT "$API/admin/company" -H 'Content-Type: application/json' -d '{"tagline":null}')"
echo "public GET /company -> $(curl -s -o /dev/null -w '%{http_code}' "$API/company")"
mongosh --quiet test_database --eval "db.company_info.updateOne({key:'company'},{\$set:{tagline:'$ORIG'}})" >/dev/null
echo "after restore GET /company -> $(curl -s -o /dev/null -w '%{http_code}' "$API/company")"
AID=$(curl -s -X POST "$API/applications" -H 'Content-Type: application/json' -d '{"position":"Site Engineer","name":"TEST_NullApp","phone":"9876543210"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["id"])')
echo "application PUT status:null -> $(curl -s -o /dev/null -w '%{http_code}' -b $J -X PUT "$API/admin/applications/$AID" -H 'Content-Type: application/json' -d '{"status":null}')"
echo "admin GET applications -> $(curl -s -o /dev/null -w '%{http_code}' -b $J "$API/admin/applications")"
echo "application PUT admin_notes:null -> $(curl -s -o /dev/null -w '%{http_code}' -b $J -X PUT "$API/admin/applications/$AID" -H 'Content-Type: application/json' -d '{"admin_notes":null}')"
mongosh --quiet test_database --eval "db.applications.deleteOne({_id:ObjectId('$AID')})"
echo "company null name: $(curl -s -o /dev/null -w '%{http_code}' -b $J -X PUT "$API/admin/company" -H 'Content-Type: application/json' -d '{"name":null}')"
