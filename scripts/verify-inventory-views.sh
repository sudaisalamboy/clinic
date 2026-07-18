#!/bin/bash
# Verify the 4 inventory views via API + browser.
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

section "1. Setup owner"
rm -f /tmp/cookies.txt
curl -sS -X POST http://localhost:3000/api/setup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Dr. Alex","password":"testpass123","autoLockMinutes":60}' \
  -c /tmp/cookies.txt -b /tmp/cookies.txt > /dev/null
echo "Owner set up"

section "2. Add medicines with various stock + expiry scenarios"
# Well-stocked, no expiry
curl -sS -X POST http://localhost:3000/api/medicines \
  -H 'Content-Type: application/json' \
  -d '{"name":"Amoxicillin","genericName":"Amoxicillin","manufacturer":"Cipla","sku":"MED-001","quantity":100,"price":8.00,"purchasePrice":5.00,"reorderLevel":20}' \
  -b /tmp/cookies.txt > /dev/null

# Low stock (below reorder level)
curl -sS -X POST http://localhost:3000/api/medicines \
  -H 'Content-Type: application/json' \
  -d '{"name":"Paracetamol","genericName":"Acetaminophen","manufacturer":"GSK","sku":"MED-002","quantity":5,"price":2.50,"purchasePrice":1.20,"reorderLevel":10}' \
  -b /tmp/cookies.txt > /dev/null

# Out of stock
curl -sS -X POST http://localhost:3000/api/medicines \
  -H 'Content-Type: application/json' \
  -d '{"name":"Cough Syrup","genericName":"Dextromethorphan","manufacturer":"Pfizer","sku":"MED-003","quantity":0,"price":6.75,"purchasePrice":4.00,"reorderLevel":5}' \
  -b /tmp/cookies.txt > /dev/null

# Expiring soon (15 days from now)
EXPIRE_15D=$(date -u -d '+15 days' +%Y-%m-%d 2>/dev/null || date -u -v+15d +%Y-%m-%d)
curl -sS -X POST http://localhost:3000/api/medicines \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Ibuprofen\",\"genericName\":\"Ibuprofen\",\"manufacturer\":\"Bayer\",\"sku\":\"MED-004\",\"quantity\":30,\"price\":4.00,\"purchasePrice\":2.00,\"reorderLevel\":10,\"expiryDate\":\"$EXPIRE_15D\"}" \
  -b /tmp/cookies.txt > /dev/null

# Already expired (10 days ago)
EXPIRED_10D=$(date -u -d '-10 days' +%Y-%m-%d 2>/dev/null || date -u -v-10d +%Y-%m-%d)
curl -sS -X POST http://localhost:3000/api/medicines \
  -H 'Content-Type: application/json' \
  -d "{\"name\":\"Aspirin\",\"genericName\":\"Acetylsalicylic Acid\",\"manufacturer\":\"Bayer\",\"sku\":\"MED-005\",\"quantity\":15,\"price\":3.00,\"purchasePrice\":1.50,\"reorderLevel\":5,\"expiryDate\":\"$EXPIRED_10D\"}" \
  -b /tmp/cookies.txt > /dev/null

echo "Added 5 medicines"

section "3. Verify search by name"
curl -sS 'http://localhost:3000/api/medicines?q=Paracetamol' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"medicines\"])} medicine(s) matching Paracetamol:')
for m in d['medicines']:
    print(f'  {m[\"name\"]} ({m[\"genericName\"]}) — {m[\"quantity\"]} units')
"

section "4. Verify search by generic name"
curl -sS 'http://localhost:3000/api/medicines?q=Acetaminophen' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"medicines\"])} medicine(s) matching Acetaminophen:')
for m in d['medicines']:
    print(f'  {m[\"name\"]} (generic: {m[\"genericName\"]})')
"

section "5. Verify search by manufacturer"
curl -sS 'http://localhost:3000/api/medicines?q=Bayer' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"medicines\"])} medicine(s) from Bayer:')
for m in d['medicines']:
    print(f'  {m[\"name\"]} — manufacturer: {m[\"manufacturer\"]}')
"

section "6. Verify low-stock filter"
curl -sS 'http://localhost:3000/api/medicines?filter=low' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"medicines\"])} low-stock medicine(s):')
for m in d['medicines']:
    print(f'  {m[\"name\"]} — {m[\"quantity\"]} units (reorder at {m[\"reorderLevel\"]})')
"

section "7. Verify expiring-soon filter"
curl -sS 'http://localhost:3000/api/medicines?filter=expiring' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"medicines\"])} expiring-soon medicine(s):')
for m in d['medicines']:
    print(f'  {m[\"name\"]} — expires {m[\"expiryDate\"][:10]}')
"

section "8. Verify expired filter"
curl -sS 'http://localhost:3000/api/medicines?filter=expired' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Found {len(d[\"medicines\"])} expired medicine(s):')
for m in d['medicines']:
    print(f'  {m[\"name\"]} — expired {m[\"expiryDate\"][:10]}')
"

section "9. Verify alerts endpoint"
curl -sS 'http://localhost:3000/api/medicines/alerts' -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'Summary: {d[\"summary\"]}')
print(f'Low stock: {len(d[\"lowStock\"])} items')
for m in d['lowStock']:
    print(f'  {m[\"name\"]} — {m[\"quantity\"]}/{m[\"reorderLevel\"]} (shortfall {m[\"shortfall\"]})')
print(f'Expiring soon: {len(d[\"expiringSoon\"])} items')
for m in d['expiringSoon']:
    print(f'  {m[\"name\"]} — {m[\"daysToExpiry\"]}d')
print(f'Expired: {len(d[\"expired\"])} items')
for m in d['expired']:
    print(f'  {m[\"name\"]} — {m[\"daysSinceExpiry\"]}d ago')
"

section "10. Test restock action"
MED_ID=$(curl -sS 'http://localhost:3000/api/medicines?q=Paracetamol' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['medicines'][0]['id'])")
echo "Restocking Paracetamol ($MED_ID) by +50 units"
curl -sS -X PUT "http://localhost:3000/api/medicines/$MED_ID" \
  -H 'Content-Type: application/json' \
  -d '{"restockBy":50}' \
  -b /tmp/cookies.txt | python3 -c "
import sys, json
d = json.load(sys.stdin)['medicine']
print(f'  After restock: {d[\"name\"]} — {d[\"quantity\"]} units')
"

section "11. Test auto-decrement on bill creation"
# Create a patient + bill with a medicine item
PATIENT_ID=$(curl -sS -X POST http://localhost:3000/api/patients \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Doe","dateOfBirth":"1990-05-15","gender":"male"}' \
  -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['patient']['id'])")

# Check stock before
STOCK_BEFORE=$(curl -sS 'http://localhost:3000/api/medicines?q=Amoxicillin' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['medicines'][0]['quantity'])")
echo "Amoxicillin stock before bill: $STOCK_BEFORE"

# Create bill with 5 Amoxicillin
curl -sS -X POST http://localhost:3000/api/bills \
  -H 'Content-Type: application/json' \
  -d "{\"patientId\":\"$PATIENT_ID\",\"items\":[{\"category\":\"medicine\",\"name\":\"Amoxicillin\",\"qty\":5,\"price\":8.00}]}" \
  -b /tmp/cookies.txt > /dev/null

STOCK_AFTER=$(curl -sS 'http://localhost:3000/api/medicines?q=Amoxicillin' -b /tmp/cookies.txt | python3 -c "import sys,json; print(json.load(sys.stdin)['medicines'][0]['quantity'])")
echo "Amoxicillin stock after bill: $STOCK_AFTER"
echo "  Auto-decremented by 5: $([ "$STOCK_AFTER" -eq "$((STOCK_BEFORE - 5))" ] && echo '✅ YES' || echo '❌ NO')"

# === Browser verification ===
section "12. Open browser and login"
agent-browser open http://localhost:3000/ 2>&1 | tail -2
sleep 3
agent-browser find label "Password" fill "testpass123" 2>&1 | tail -1
agent-browser find role button click --name "Unlock" 2>&1 | tail -1
sleep 4

section "13. Check inventory alert banner on dashboard"
agent-browser screenshot /home/z/my-project/scripts/inventory-alert-banner.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -30

section "14. Go to Inventory tab"
agent-browser find role tab click --name "Inventory" 2>&1 | tail -1 || agent-browser find role tab click --name "Stock" 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/inventory-stock-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -60

section "15. VLM check on Stock view"
z-ai vision -p "This is a medicine stock table. Describe in 4-5 sentences: 1) Are there columns for Name, Generic, Manufacturer, Stock, Sell price, Cost, Expiry? 2) Are there stock status badges (Out of stock, Critical, Low, Healthy)? 3) Are there search and Add medicine controls? 4) Is there a total inventory value shown?" -i "/home/z/my-project/scripts/inventory-stock-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "16. Click Low Stock sub-tab"
LOW_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Low Stock' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Low Stock btn: $LOW_BTN"
agent-browser click @$LOW_BTN 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/inventory-low-stock-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "17. VLM check on Low Stock view"
z-ai vision -p "This is a low stock alert view. Describe in 3-4 sentences: 1) Are there medicine entries showing stock vs reorder level? 2) Are there shortage amounts? 3) Are there Restock buttons? 4) Are out-of-stock items highlighted differently?" -i "/home/z/my-project/scripts/inventory-low-stock-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "18. Click Expiry sub-tab"
EXPIRY_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Expiry' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Expiry btn: $EXPIRY_BTN"
agent-browser click @$EXPIRY_BTN 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/inventory-expiry-view.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -40

section "19. VLM check on Expiry view"
z-ai vision -p "This is an expiry alert view. Describe in 3-4 sentences: 1) Are there tabs for Expired and Expiring soon? 2) Are expired items shown with red highlighting? 3) Are expiry dates and days-until-expiry visible? 4) Are there dispose/delete actions?" -i "/home/z/my-project/scripts/inventory-expiry-view.png" 2>&1 | grep -A2 '"content":' | head -3

section "20. Click Add medicine"
# Go back to stock first
STOCK_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Stock' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
agent-browser click @$STOCK_BTN 2>&1 | tail -1
sleep 2
ADD_BTN=$(agent-browser snapshot -i 2>&1 | grep -i 'Add medicine' | grep -oE 'ref=e[0-9]+' | head -1 | sed 's/ref=//')
echo "Add btn: $ADD_BTN"
agent-browser click @$ADD_BTN 2>&1 | tail -1
sleep 3
agent-browser screenshot /home/z/my-project/scripts/inventory-add-form.png 2>&1 | tail -1
agent-browser snapshot -i 2>&1 | head -50

section "21. VLM check on Add Medicine form"
z-ai vision -p "This is an Add Medicine form. Describe in 4-5 sentences: 1) Are there fields for Name, Generic name, SKU, Manufacturer, Batch number? 2) Are there stock fields (Quantity, Reorder level, Expiry date)? 3) Are there pricing fields (Purchase price, Selling price)? 4) Is there a live margin/pricing summary? 5) Are there Cancel and Add medicine buttons?" -i "/home/z/my-project/scripts/inventory-add-form.png" 2>&1 | grep -A2 '"content":' | head -3

section "22. Console errors"
agent-browser errors 2>&1 | head -20 || true

# Cleanup
echo ""
echo "=== Cleanup ==="
agent-browser close 2>&1 | tail -1 || true
kill $DEV_PID 2>/dev/null || true
wait $DEV_PID 2>/dev/null || true
echo "Done"
