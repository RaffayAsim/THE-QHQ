# 🚀 LIVE TESTING - BOOKING SYSTEM FIX

**Status**: ✅ Development Server Running  
**Local Link**: http://localhost:8080/  
**Network Link**: http://192.168.64.210:8080/  
**Date**: May 26, 2026

---

## 🎯 WHAT TO TEST

### Core Booking Types

#### Test 1: Solo Booking
- Create a booking for yourself only
- No companion
- **Expected Admin Result**: 1 card showing solo booking
- **Expected Frontend**: 1 card in My Bookings

#### Test 2: Couple Booking ⭐ (This is the main fix)
- Create booking
- Click "Add Partner/Companion"
- Add companion details (email required)
- Submit booking
- **Expected Admin Result**: 1 card (NOT 2) with both attendees listed
- **Expected Frontend**: Host sees 1 card, Companion also sees 1 card
- **Expected DB**: 2 rows with same pair_code

#### Test 3: Group Booking
- Create booking for 4+ people
- **Expected Admin Result**: 1 card (NOT 4) with all members in attendees list
- **Expected Frontend**: 1 card with all group members

---

## 🧪 STEP-BY-STEP VERIFICATION

### In Admin Panel (Bookings Management)

**Step 1: Create Couple Booking**
1. Open localhost link
2. Create event (if needed)
3. Create couple booking with yourself + companion
4. Go to Admin → Bookings
5. **Look for**: Single card (not 2 duplicate cards)

**Step 2: Check Details**
1. Click on the booking card
2. **Should see**:
   - Host name
   - Companion in attendees list
   - Both emails
   - Single set of action buttons

**Step 3: Verify Pagination**
1. Create multiple couple bookings (3-4)
2. Check pagination shows correct count
3. **Example**: 3 couple bookings = 3 total (not 6)

**Step 4: Admin Actions**
1. Try to approve couple booking
2. **Expected**: Updates entire couple (both host + companion)
3. Check status updated for both

---

## 📊 QUICK COMPARISON TABLE

| Scenario | Before Fix | After Fix | Status |
|----------|-----------|----------|--------|
| Create 1 couple booking | 2 cards show | 1 card shows | ✅ Testing |
| Pagination count | 2 | 1 | ✅ Testing |
| Attendees visible | Split cards | Single card | ✅ Testing |
| Group booking | N cards | 1 card | ✅ Testing |
| Frontend host view | 1 card | 1 card | ✅ Testing |
| Frontend companion view | 1 card | 1 card | ✅ Testing |

---

## 🔍 DATABASE VERIFICATION

**To check database state**, run this SQL query:

```sql
SELECT 
  id, 
  email, 
  username,
  isCoupleBooking, 
  isGuestEntry, 
  pair_code,
  created_at
FROM wp_usereventsbookings
ORDER BY pair_code DESC, id DESC
LIMIT 20;
```

**For couple bookings, you should see**:
- 2 rows with same pair_code
- Row 1: isGuestEntry = 0 (host)
- Row 2: isGuestEntry = 1 (companion)

---

## 🎬 API VERIFICATION

### Check Admin API Response

```bash
# In browser console or Postman:
fetch('http://localhost/wp-json/app/v1/admin/bookings?per_page=50')
  .then(r => r.json())
  .then(data => {
    console.log('Total bookings:', data.pagination.total);
    console.log('Bookings returned:', data.data.length);
    // For couple bookings, total should equal bookings returned
  });
```

**Expected for 3 couple bookings**:
- `pagination.total`: 3 (not 6)
- `data.length`: 3 (not 6)

### Check Frontend API Response

```bash
# In browser console:
fetch('http://localhost/wp-json/app/v1/my-bookings')
  .then(r => r.json())
  .then(data => console.log(data));
```

**Expected**: Single bookings per couple

---

## ✅ FINAL VERIFICATION CHECKLIST

After testing, verify ALL of these:

- [ ] **Solo bookings**: Still show 1 card (unchanged)
- [ ] **Couple bookings**: Show 1 card (was 2 before) ⭐
- [ ] **Admin pagination**: Count is correct (deduplicated)
- [ ] **Attendees visible**: Both people shown in one card
- [ ] **Host view**: Sees 1 couple booking
- [ ] **Companion view**: Sees same 1 couple booking
- [ ] **Admin actions**: Can approve/reject entire couple
- [ ] **Group bookings**: Show 1 card with all members
- [ ] **No duplicates**: No more duplicate cards in admin
- [ ] **Email notifications**: Still sent to both (if applicable)

---

## 🚨 IF YOU ENCOUNTER ISSUES

### Issue: Still seeing 2 cards for couple booking

**Debug Steps**:
1. Clear browser cache (Ctrl+Shift+Del)
2. Check database: Should show 2 rows with same pair_code
3. Check API response in browser console
4. Verify pair_code is being set correctly

### Issue: Pagination count wrong

**Debug Steps**:
1. Count total rows in database
2. Check `pagination.total` in API response
3. Should equal unique pair_codes (not total rows)

### Issue: Attendees not showing

**Debug Steps**:
1. Check invitees array in API response
2. Verify pair_code linking is correct
3. Check both rows exist in database

---

## 📝 TESTING RESULTS TEMPLATE

```
DATE TESTED: ___________
TESTER: ___________

✅ SOLO BOOKING
- Admin shows 1 card: Yes/No
- Status: ✅/❌

✅ COUPLE BOOKING (Main Fix)
- Admin shows 1 card (not 2): Yes/No
- Attendees visible: Yes/No
- Both people listed: Yes/No
- Status: ✅/❌

✅ GROUP BOOKING
- Admin shows 1 card: Yes/No
- All members listed: Yes/No
- Status: ✅/❌

✅ PAGINATION
- Count correct: Yes/No
- Pages navigation works: Yes/No
- Status: ✅/❌

✅ FRONTEND
- Host sees 1 couple booking: Yes/No
- Companion sees 1 couple booking: Yes/No
- Status: ✅/❌

OVERALL STATUS: ✅ PASS / ❌ FAIL

NOTES:
_____________________________
```

---

## 🔗 LINKS TO USE

**Frontend URL**:
```
http://localhost:8080/
```

**Admin Panel**: (if integrated with WordPress)
```
http://localhost/wp-admin/
```

**API Base**: (if WordPress running locally)
```
http://localhost/wp-json/app/v1/
```

---

**Next Step**: Open the localhost link and test the couple booking flow! Let me know the results. 🚀

