#!/bin/bash
# Verify the 3 prescription views via API + browser.
set -e

cd /home/z/my-project

echo "=== Starting dev server ==="
node ./node_modules/.bin/next dev -p 3000 > /home/z/my-project/dev.log 2>&1 &
DEV_PID=$!

for i in $(seq 1 60); do
  CODE=$(curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null || true)
  if [ "$CODE" = "200" ] || [ "$CODE" = "500" ]; then
    echo "Server ready after $i seconds"
    break
  fi
  sleep 1
done

section() { echo ""; echo "===== $1 ====="; }

section "1. Setup owner + patient + doctor + medicine"
rm -f /tmp/cookies.txt
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt > /dev/null

PATIENT_ID=$(curl -sS -X POST http://localhost:3000/api/patients \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","dateOfBirth":"1990-05-15","gender":"male","phone":"+1-555-1000"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['patient']['id'])")

DEPT_ID=$(curl -sS http://localhost:3000/api/departments -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['departments'][0]['id'])")
DOCTOR_ID=$(curl -sS -X POST http://localhost:3000/api/doctors \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Dr. Sarah Chen\",\"specialization\":\"Cardiologist\",\"consultationFee\":150,\"departmentId\":\"$DEPT_ID\"}" \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['doctor']['id'])")

MED_ID=$(curl -sS -X POST http://localhost:3000/api/medicines \
  -H 'Content-Type: application/json' \
  -d '{"name":"Amoxicillin","genericName":"Amoxicillin","manufacturer":"Cipla","sku":"MED-001","quantity":50,"price":8.00,"purchasePrice":5.00,"reorderLevel":10}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['medicine']['id'])")

echo "Patient: $PATIENT_ID"
echo "Doctor: $DOCTOR_ID"
echo "Medicine: $MED_ID (stock: 50)"

section "2. Create prescription — verify auto-generated number"
NEXT_VISIT=$(date -u -d '+7 days' +%Y-%m-%d 2>/dev/null || date -u -v+7d +%Y-%m-%d)
RX=$(curl -sS -X POST http://localhost:3000/api/prescriptions \
  -H 'Content-Type: application/json' \
  -d "{
    \"patientId\":\"$PATIENT_ID\",
    \"doctorId\":\"$DOCTOR_ID\",
    \"symptoms\":\"Fever for 3 days, sore throat\",
    \"temperature\":\"101.2\",
    \"bloodPressure\":\"120/80\",
    \"pulse\":\"88 bpm\",
    \"weight\":\"70 kg\",
    \"diagnosis\":\"Bacterial pharyngitis\",
    \"medicines\":[
      {\"medicineId\":\"$MED_ID\",\"name\":\"Amoxicillin\",\"dosage\":\"1 capsule\",\"frequency\":\"3x daily\",\"duration\":\"7 days\",\"instructions\":\"After meals\"},
      {\"name\":\"Paracetamol\",\"dosage\":\"1 tablet\",\"frequency\":\"as needed\",\"duration\":\"5 days\",\"instructions\":\"For fever\"}
    ],
    \"advice\":\"Rest, drink plenty of fluids, avoid cold drinks.\",
    \"nextVisitDate\":\"$NEXT_VISIT\"
  }" -b /tmp/cookies.txt)
RX_ID=$(echo "$RX" | python3 -c "import sys,json; print(json.load(sys.stdin)['prescription']['id'])")
echo "$RX" | python3 -c "
import sys, json
d = json.load(sys.stdin)['prescription']
print(f'  RX #: {d[\"prescriptionNumber\"]}')
print(f'  Patient: {d[\"patient\"][\"name\"]}')
print(f'  Doctor: {d[\"doctor\"][\"name\"] if d.get(\"doctor\") else \"—\"}')
print(f'  Medicines: {len(d[\"medicines\"])}')
for m in d['medicines']:
    print(f'    - {m[\"name\"]} | {m[\"dosage\"]} | {m[\"frequency\"]} | {m[\"duration\"]}')
print(f'  Advice: {d[\"advice\"][:50]}...')
print(f'  Next visit: {d[\"nextVisitDate\"][:10] if d.get(\"nextVisitDate\") else \"—\"}')
print(f'  Medical record ID: {d[\"medicalRecord\"][\"id\"]}')
print(f'  Diagnosis: {d[\"medicalRecord\"][\"diagnosis\"]}')
"

section "3. Verify medicine stock auto-decremented"
STOCK_AFTER=$(curl -sS "http://localhost:3000/api/medicines?q=Amoxicillin" -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['medicines'][0]['quantity'])")
echo "  Amoxicillin stock after prescription: $STOCK_AFTER (was 50, expected 49)"
echo "  Auto-decremented: $([ "$STOCK_AFTER" -eq 49 ] && echo '✅ YES' || echo '❌ NO')"

section "4. Create second prescription — verify number increments"
RX2=$(curl -sS -X POST http://localhost:3000/api/prescriptions \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"doctorId\":\"$DOCTOR_ID\",\"diagnosis\":\"Follow-up\",\"medicines\":[{\"name\":\"Vitamin C\",\"dosage\":\"1 tablet\",\"frequency\":\"daily\",\"duration\":\"30 days\"}]}" \
  -b /tmp/cookies.txt)
echo "$RX2" | python3 -c "import sys,json; d=json.load(sys.stdin)['prescription']; print(f'  RX #: {d[\"prescriptionNumber\"]}')"

section "5. List all prescriptions"
curl -sS 'http://localhost:3000/api/prescriptions' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Total: {len(d[\"prescriptions\"])}')
for p in d['prescriptions']:
    print(f'  {p[\"prescriptionNumber\"]} | {p[\"patient\"][\"name\"]} | {len(p[\"medicines\"])} meds | {p[\"createdAt\"][:10]}')
"

section "6. Search prescriptions by patient name"
curl -sS 'http://localhost:3000/api/prescriptions?q=John' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Found {len(d[\"prescriptions\"])} matching John')
"

section "7. Get prescription details"
curl -sS "http://localhost:3000/api/prescriptions/$RX_ID" -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)['prescription']
print(f'  RX #: {d[\"prescriptionNumber\"]}')
print(f'  Patient: {d[\"patient\"][\"name\"]} ({d[\"patient\"][\"patientCode\"]})')
print(f'  Doctor: {d[\"doctor\"][\"name\"]} ({d[\"doctor\"][\"specialization\"]})')
print(f'  Visit date: {d[\"medicalRecord\"][\"visitDate\"][:10]}')
print(f'  Symptoms: {d[\"medicalRecord\"][\"symptoms\"]}')
print(f'  Vitals: temp={d[\"medicalRecord\"][\"temperature\"]}, BP={d[\"medicalRecord\"][\"bloodPressure\"]}, pulse={d[\"medicalRecord\"][\"pulse\"]}')
print(f'  Diagnosis: {d[\"medicalRecord\"][\"diagnosis\"]}')
print(f'  Medicines:')
for m in d['medicines']:
    print(f'    - {m[\"name\"]} | {m[\"dosage\"]} | {m[\"frequency\"]} | {m[\"duration\"]} | {m.get(\"instructions\",\"\")}')
print(f'  Advice: {d[\"advice\"]}')
print(f'  Next visit: {d[\"nextVisitDate\"][:10] if d.get(\"nextVisitDate\") else \"—\"}')
"

# === Browser verification ===
section "8. Open browser and login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "9. Go to Prescriptions tab (Rx)"
agent-browser find role tab click --name "Rx" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/rx-list-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "10. VLM check on list view"
z-ai vision -p "This is a prescriptions list view. Describe in 3-4 sentences: 1) Are there prescription entries with RX numbers? 2) Are patient names visible? 3) Are there medicine counts and dates? 4) Is there a Create button?" -i "/home/z/my-project/scripts/rx-list-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "11. Click Create prescription"
CREATE_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Create' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Create btn: $CREATE_BTN"
agent-browser click @$CREATE_BTN 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/rx-create-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "12. VLM check on Create form"
z-ai vision -p "This is a Create Prescription form. Describe in 4-5 sentences: 1) Is there a patient search field? 2) Is there a doctor dropdown and visit date? 3) Are there medical record fields (symptoms, vitals, diagnosis)? 4) Are there medicine rows with dosage/frequency/duration fields? 5) Are there advice and next visit fields?" -i "/home/z/my-project/scripts/rx-create-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "13. Cancel back to list, click a prescription to view details"
agent-browser find role button click --name "Cancel" 2>&1 | tail -1
sleep 2
# Click the first prescription's View button
VIEW_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'View' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "View btn: $VIEW_BTN"
if [ -n "$VIEW_BTN" ]; then
  agent-browser click @$VIEW_BTN 2>&1 | tail -1
  sleep 3
fi
agent-browser screenshot /home/z/my-project/scripts/rx-details-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "14. VLM check on Details/Print view"
z-ai vision -p "This is a prescription details/print view. Describe in 4-5 sentences: 1) Is there a prescription number (RX-XXXX)? 2) Are patient and doctor details shown? 3) Are there vitals and diagnosis? 4) Is there a medicines table with dosage/frequency/duration? 5) Is there a Print button and next visit date?" -i "/home/z/my-project/scripts/rx-details-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "15. Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
