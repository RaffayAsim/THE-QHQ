# 🧪 QUICK TESTING GUIDE - BOOKING DISPLAY FIX

**Status**: Ready for Testing  
**Fix Applied**: ✅ Admin API Deduplication (headless-user-register.php)

---

## 🚀 QUICK TEST (5 minutes)

### Test 1: Create & Verify Couple Booking

**Steps**:

1. **Create a couple booking**:
   - Login as a user
   - Select an event
   - Add yourself
   - Click "Add Partner/Companion"
   - Select or invite someone
   - Submit booking

2. **Check Database**:
   ```sql
   SELECT id, email, username, isCoupleBooking, isGuestEntry, pair_code
   FROM wp_usereventsbookings
   WHERE pair_code != '' AND pair_code IS NOT NULL
   ORDER BY id DESC
   LIMIT 5;
   
   -- Expected: 2 rows with same pair_code
   -- Row 1: isGuestEntry = 0 (host)
   -- Row 2: isGuestEntry = 1 (companion)
   ```

3. **Check Admin Panel**:
   - Go to WordPress Admin → Event Bookings
   - Search for the host's booking
   - **Expected**: Shows **1 card only** (not 2)
   - Look for "Couple Pass" label
   - Should show attendees list with both people

4. **Check Admin API**:
   ```bash
   curl -X GET "https://site.com/wp-json/app/v1/admin/bookings?per_page=50" \
        -H "Authorization: Bearer [ADMIN_TOKEN]"
   
   # Expected response:
   {
     "data": [
       {
         "id": 101,  # Host row
         "email": "host@example.com",
         "is_couple_booking": 1,
         "invitees": [
           {
             "id": 102,
             "email": "companion@example.com",
             "status": "Waiting Approval"
           }
         ]
       }
     ],
     "pagination": {
       "total": 1  # ✅ KEY: Should be 1, not 2
     }
   }
   ```

---

### Test 2: Verify Frontend Still Works

**Steps**:

1. **Login as Host**:
   - Go to Dashboard → My Bookings
   - **Expected**: Shows 1 card (should already be working)

2. **Login as Companion**:
   - Go to Dashboard → My Bookings
   - **Expected**: Shows 1 card with same booking

3. **Check Attendees**:
   - Both should see complete attendee list
   - Both should see each other

---

### Test 3: Create & Verify Solo Booking

**Steps**:

1. **Create solo booking**:
   - Login as user
   - Select event
   - Don't add companion
   - Submit

2. **Check Admin Panel**:
   - **Expected**: Shows 1 card (unchanged - already worked)
   - Should show "Single Pass" label

3. **Database verification**:
   ```sql
   SELECT id, pair_code FROM wp_usereventsbookings
   WHERE email = 'solo@example.com' ORDER BY id DESC;
   
   -- Expected: 1 row with pair_code = '' (empty)
   ```

---

## ✅ DETAILED VERIFICATION CHECKLIST

### ✅ Database Level

```sql
-- Check 1: Couple bookings have 2 rows
SELECT pair_code, COUNT(*) as count, GROUP_CONCAT(email) as emails
FROM wp_usereventsbookings
WHERE isCoupleBooking = 1 AND pair_code != ''
GROUP BY pair_code;

-- Expected: Each pair_code shows count=2

-- Check 2: Host vs Companion distinction
SELECT id, email, isGuestEntry, pair_code
FROM wp_usereventsbookings
WHERE pair_code = 'PAIR_ABC123'
ORDER BY isGuestEntry ASC;

-- Expected: 
-- id=101, email=host@ex.com,      isGuestEntry=0
-- id=102, email=companion@ex.com, isGuestEntry=1
```

---

### ✅ Admin API Level

```bash
# Test 1: Check booking count
curl -X GET "http://localhost/wp-json/app/v1/admin/bookings?per_page=100" \
     -H "Authorization: Bearer TOKEN" | jq '.pagination.total'

# Should equal number of unique bookings (couples count as 1)
# NOT total number of rows

# Test 2: Check couple booking structure
curl -X GET "http://localhost/wp-json/app/v1/admin/bookings?per_page=100" \
     -H "Authorization: Bearer TOKEN" | jq '.data[] | select(.is_couple_booking == 1) | {id, email, invitees}'

# Expected:
# {
#   "id": 101,
#   "email": "host@example.com",
#   "invitees": [
#     {"id": 102, "email": "companion@example.com", ...}
#   ]
# }
```

---

### ✅ Frontend Display Level

**Admin Panel - Event Bookings Tab**:
- [ ] Solo bookings show 1 card
- [ ] Couple bookings show 1 card (not 2)
- [ ] Group bookings show 1 card (not N)
- [ ] Each card shows correct attendees
- [ ] Pagination count is correct
- [ ] Status updates work
- [ ] Can approve/reject entire booking

**User Dashboard - My Bookings**:
- [ ] Host sees 1 card
- [ ] Companion sees 1 card
- [ ] Both see same booking
- [ ] Attendees list shows both
- [ ] Can accept/reject/cancel

---

## 🔴 WHAT TO LOOK FOR (Issues)

### ❌ Before Fix (these were the problems)
- Admin shows 2 cards for couple booking
- Pagination shows wrong count
- Each card shows only one person
- Duplicate booking entries
- Confusing admin experience

### ✅ After Fix (expected behavior)
- Admin shows 1 card per couple
- Pagination shows correct count
- Each card shows all attendees
- No duplicate entries
- Clean admin experience

---

## 📊 SIDE-BY-SIDE COMPARISON

| Booking Type | Before Fix | After Fix |
|---|---|---|
| **Solo** | 1 card ✅ | 1 card ✅ |
| **Couple** | 2 cards ❌ | 1 card ✅ |
| **Group (4)** | 4 cards ❌ | 1 card ✅ |
| **Admin Count** | Rows | Bookings ✅ |
| **Pagination** | Wrong | Correct ✅ |

---

## 🐛 TROUBLESHOOTING

### Issue: Still showing 2 cards for couple booking

**Checklist**:
1. ✅ Confirm fix was applied to `/Last WP Plugin/headless-user-register/headless-user-register.php` (line 4548)
2. ✅ Clear browser cache
3. ✅ Check API response directly (see above curl command)
4. ✅ Verify database has 2 rows with same pair_code
5. ✅ Check for PHP errors in logs

### Issue: Pagination count wrong

**Checklist**:
1. ✅ Verify deduplication code is executing
2. ✅ Check `pagination.total` in API response
3. ✅ Count should be deduplicated bookings, not rows
4. ✅ Database rows should be more than total count

### Issue: Attendees not showing

**Checklist**:
1. ✅ Check `invitees` array in API response
2. ✅ Verify pair_code links are correct
3. ✅ Check formatting in `app_admin_format_booking_row()`
4. ✅ Ensure both rows have same pair_code

---

## 📝 TEST RESULTS TEMPLATE

After testing, fill this out:

```
DATE: ___________
TESTER: ___________

SOLO BOOKING:
- [ ] Database shows 1 row: pair_code empty
- [ ] Admin shows 1 card: ✅/❌
- [ ] Display correct: ✅/❌

COUPLE BOOKING:
- [ ] Database shows 2 rows: same pair_code
- [ ] Admin shows 1 card: ✅/❌
- [ ] Shows attendees: ✅/❌
- [ ] Correct person selected: ✅/❌
- [ ] Frontend shows 1 card: ✅/❌

GROUP BOOKING (4 people):
- [ ] Database shows 4 rows: same pair_code
- [ ] Admin shows 1 card: ✅/❌
- [ ] Shows all 4 attendees: ✅/❌
- [ ] Group label correct: ✅/❌

PAGINATION:
- [ ] Total count correct: ✅/❌
- [ ] Pages calculated right: ✅/❌
- [ ] Browsing works: ✅/❌

NOTES: ___________________
```

---

## 🎯 KEY POINTS TO VERIFY

1. **Database**: 2 rows created per couple ✅
2. **Admin API**: Deduplicates to 1 booking ✅
3. **Admin UI**: Shows 1 card ✅
4. **Pagination**: Counts correctly ✅
5. **Attendees**: Shows both people ✅
6. **Frontend**: Still works ✅
7. **Actions**: Can approve/reject ✅
8. **Emails**: Still sent to both ✅

---

## ✅ FIX VERIFIED WHEN

All of the following are true:

1. ✅ Create couple booking → 1 card in admin (not 2)
2. ✅ Pagination total = 1 (not 2) for couple
3. ✅ Attendees list shows both people
4. ✅ Group booking (4 people) → 1 card in admin (not 4)
5. ✅ Pagination total = 1 (not 4) for group
6. ✅ Frontend shows 1 card for both host and companion
7. ✅ Solo bookings still work as before
8. ✅ Can approve/reject entire couple booking

---

**Ready to test!** Let me know the results. 🚀

