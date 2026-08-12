# 🔍 COUPLE BOOKING SYSTEM ISSUE ANALYSIS
**Date:** May 26, 2026  
**Issue:** Couple bookings show as single booking in admin panel, with couple info in description but not properly grouped

---

## 📊 EXECUTIVE SUMMARY

The couple booking system has a **critical data flow mismatch**:

| Layer | Status | Issue |
|-------|--------|-------|
| **Database Storage** | ✅ Correct | 2 rows per couple (host + companion), linked by `pair_code` |
| **Frontend API** | ✅ Correct | Deduplicates to show 1 card per couple |
| **Admin API** | ❌ **BROKEN** | Returns 2 rows per couple, no deduplication |
| **Admin UI** | ❌ **BROKEN** | Displays 2 separate cards per couple booking |

---

## 🗄️ DATA STRUCTURE EXPLANATION

### When a Couple Booking is Created
**Files:** 
- `Last WP Plugin/events-api/events-api.php` (lines 2276-2530: `eapi_rest_event_booking()`)

**What happens:**
1. ONE WordPress post of type `event_booking` is created (stores main booking metadata)
2. TWO rows are inserted into custom table `wp_usereventsbookings`:

**Custom Table Row 1 (Host/Primary)**
```
id: 100
event_id: 5
event_name: "Neon Arena VIP"
username: "Ali"
email: "ali@example.com"
phone: "03001234567"
nic: "12345-6789012-3"
carNumber: "ABC-123"
isCoupleBooking: 1
isGuestEntry: 0
pair_code: "987654"
couple_name: "Fatima"
couple_email: "fatima@example.com"
couple_phone: "03009876543"
couple_nic: "98765-4321098-7"
coupleCarNumber: "XYZ-789"
qr_id: "QR001"
user_status: "Waiting Approval"
invited_by_email: ""
```

**Custom Table Row 2 (Companion/Guest)**
```
id: 101
event_id: 5
event_name: "Neon Arena VIP"
username: "Fatima"
email: "fatima@example.com"
phone: "03009876543"
nic: "98765-4321098-7"
carNumber: "XYZ-789"
isCoupleBooking: 1
isGuestEntry: 1
pair_code: "987654"  <-- SAME pair_code as Row 1
couple_name: "Ali"
couple_email: "ali@example.com"
couple_phone: "03001234567"
couple_nic: "12345-6789012-3"
coupleCarNumber: "ABC-123"
qr_id: "QR001"  <-- SAME qr_id as Row 1
user_status: "Waiting Approval"
invited_by_email: "ali@example.com"
```

**WordPress Post (event_booking CPT)**
```
ID: 42
post_type: event_booking
post_title: "Booking - Neon Arena VIP by Ali"
post_status: pending

Meta Fields:
- booking_qr_id: QR001
- booking_is_couple: yes
- booking_couple_name: Fatima
- booking_couple_email: fatima@example.com
- booking_couple_phone: 03009876543
- booking_couple_details: {name, email, phone, nic, carNumber, payment_status, user_id}
- booking_couple_payment_status: invitee_needs_payment | covered_by_inviter
```

### Key Linking Fields
- **`pair_code`**: Groups both rows together (host row 100 & guest row 101 both have "987654")
- **`qr_id`**: Used to locate the WordPress post via `eapi_find_booking_post_id_by_qr_id(qr_id)`
- **`isCoupleBooking`**: Flag =1 for couple bookings (set on BOTH rows)
- **`isGuestEntry`**: Distinguishes: 0=host/primary, 1=companion/guest

---

## 🔴 WHERE THE PROBLEM OCCURS

### Problem 1: Admin Endpoint NOT Deduplicating Couple Bookings

**File:** `Last WP Plugin/headless-user-register/headless-user-register.php`  
**Function:** `app_admin_get_bookings()` (line 4548)  
**Endpoint:** `GET /app/v1/admin/bookings`

```php
function app_admin_get_bookings(WP_REST_Request $request)
{
    global $wpdb;
    $table = $wpdb->prefix . 'usereventsbookings';
    
    $filters = app_admin_get_booking_filters($request);
    // ... pagination setup ...
    
    // ❌ ISSUE: Fetches ALL rows from custom table, no deduplication!
    $data_sql = "SELECT * FROM {$table} {$where_sql} ORDER BY id DESC LIMIT %d OFFSET %d";
    $rows = $wpdb->get_results($wpdb->prepare($data_sql, ...), ARRAY_A);
    
    // Returns BOTH rows for couple bookings
    return [
        'success' => true,
        'data'    => array_map('app_admin_format_booking_row', $rows ?? []),
    ];
}
```

**What Should Happen:**
- Should group rows by `pair_code` (like frontend API does)
- Return only 1 row per couple booking (selecting the host row: `isGuestEntry=0`)

**Current Behavior:**
- Returns both row 100 (host) and row 101 (companion)
- Both appear as separate bookings in admin UI
- Both show `isCoupleBooking=1` flag as "Couple Booking"

---

### Problem 2: Frontend Admin UI Displays All Returned Rows

**File:** `src/pages/WordPressAdminPage.tsx`  
**Component:** `BookingsManagement` (via import)  
**File:** `src/components/admin/BookingsManagement.tsx`

**Hook:** `useBookings()` → `useWordPressBookings({ per_page: 10000, include_guests: true })`

```typescript
// In useWordPressData.tsx line 430
export const useWordPressBookings = (params?: {...}) => {
  return useQuery({
    queryKey: ["wp-bookings", params],
    queryFn: async () => {
      const response = await wpBookings.getAll(params);
      // API returns 2 rows per couple ❌
      const bookings = response.data || response || [];
      return { data: transformedBookings, pagination };
    },
  });
};
```

**The UI then renders:**
```typescript
// BookingsManagement.tsx: filters and displays all bookings without deduplication
const filteredBookings = useMemo(() => {
  return bookings.filter((b: any) => {
    // No grouping by pair_code, no deduplication
    return matchesSearch && matchesStatus;
  });
}, [bookings, bookingSearchQuery, bookingStatusFilter]);

// Creates cards for ALL rows
const paginatedBookings = filteredBookings.slice(start, start + bookingsPerPage);
// Each card maps to a booking row - shows 2 cards per couple!
```

---

### Problem 3: The Comparison - Frontend API DOES Deduplicate

**File:** `Last WP Plugin/events-api/events-api.php`  
**Function:** `eapi_rest_get_my_bookings()` (line 2276)  
**Endpoint:** `GET /app/v1/my-bookings` (used by frontend, NOT admin)

```php
// ✅ Frontend API DOES THIS CORRECTLY:

// Step 1: Fetch all rows for logged-in user
$primary_results = $wpdb->get_results(
    "SELECT * FROM {$table} WHERE email = %s ...",
    [$user_email, ...]
);

// Step 2: Extract pair_codes to fetch related rows
$main_pair_codes = array_values(array_unique(array_filter($main_pair_codes)));

// Step 3: Fetch ALL rows with those pair_codes
$linked_rows = $wpdb->get_results(
    "SELECT * FROM {$table} WHERE pair_code IN ({$placeholders}) ...",
    $main_pair_codes
);

// ✅ Step 4: GROUP by pair_code and DEDUPLICATE
$grouped_results = [];
foreach ($results_all as $row) {
    $pc = sanitize_text_field((string) ($row['pair_code'] ?? ''));
    if ($pc === '') {
        $grouped_results['single_' . $row['id']][] = $row;  // Single bookings separate
    } else {
        $grouped_results[$pc][] = $row;  // Couple bookings grouped by pair_code
    }
}

// ✅ Step 5: Select ONE row per pair_code group
$deduped_results = [];
foreach ($grouped_results as $key => $val) {
    if (strpos($key, 'single_') === 0) {
        // Single booking - use as-is
        $deduped_results[] = $val[0];
    } else {
        // Couple booking - select ONE row
        $chosen_row = null;
        
        // Priority 1: Row matching logged-in user's email
        foreach ($val as $row) {
            if (strtolower($row['email']) === strtolower($user_email)) {
                $chosen_row = $row;
                break;
            }
        }
        
        // Priority 2: Host row (isGuestEntry = 0)
        if (!$chosen_row) {
            foreach ($val as $row) {
                if (intval($row['isGuestEntry'] ?? 0) === 0) {
                    $chosen_row = $row;
                    break;
                }
            }
        }
        
        // Priority 3: First row
        if (!$chosen_row && !empty($val)) {
            $chosen_row = $val[0];
        }
        
        if ($chosen_row) {
            $deduped_results[] = $chosen_row;  // ✅ Only ONE row returned
        }
    }
}
```

**Result:** Frontend users see 1 card per couple booking ✅

---

## 🎯 ROOT CAUSE ANALYSIS

| Component | Stores 2 Rows | Handles 2 Rows | Returns 2 Rows | Expected |
|-----------|:-:|:-:|:-:|---|
| **Database** | ✅ Yes | - | - | Correct design |
| **Frontend API** | ✅ Yes | ✅ Groups & dedupes | ❌ No | Returns 1 row ✅ |
| **Admin API** | ✅ Yes | ❌ **No grouping** | ✅ **Yes (problem!)** | Should dedupe ❌ |
| **Frontend UI** | - | - | ✅ **Shows 2 cards** | Should show 1 ❌ |
| **Admin UI** | - | - | ✅ **Shows 2 cards** | Should show 1 ❌ |

---

## 📍 LOCATION OF ISSUES & FIXES NEEDED

### Issue #1: Admin API Endpoint Missing Deduplication
**File:** `Last WP Plugin/headless-user-register/headless-user-register.php`  
**Location:** Line 4548 in `app_admin_get_bookings()`  
**Fix Required:** Add deduplication logic similar to frontend API

**Before (Current - BROKEN):**
```php
function app_admin_get_bookings(WP_REST_Request $request) {
    // ... pagination ...
    $data_sql = "SELECT * FROM {$table} {$where_sql} ORDER BY id DESC LIMIT %d OFFSET %d";
    $rows = $wpdb->get_results($wpdb->prepare($data_sql, ...), ARRAY_A);
    
    return [
        'success' => true,
        'data'    => array_map('app_admin_format_booking_row', $rows ?? []),
    ];
}
```

**After (FIXED):**
```php
function app_admin_get_bookings(WP_REST_Request $request) {
    // ... pagination ...
    $rows = $wpdb->get_results($wpdb->prepare($data_sql, ...), ARRAY_A);
    
    // ✅ GROUP and DEDUPLICATE by pair_code
    $grouped = [];
    foreach ($rows as $row) {
        $pc = sanitize_text_field((string) ($row['pair_code'] ?? ''));
        if ($pc === '') {
            $grouped['single_' . $row['id']][] = $row;
        } else {
            $grouped[$pc][] = $row;
        }
    }
    
    $deduped = [];
    foreach ($grouped as $key => $val) {
        if (strpos($key, 'single_') === 0) {
            $deduped[] = $val[0];
        } else {
            // Pick ONE: prioritize host row (isGuestEntry = 0)
            $chosen = null;
            foreach ($val as $r) {
                if (intval($r['isGuestEntry'] ?? 0) === 0) {
                    $chosen = $r;
                    break;
                }
            }
            if (!$chosen && !empty($val)) {
                $chosen = $val[0];
            }
            if ($chosen) {
                $deduped[] = $chosen;
            }
        }
    }
    
    return [
        'success' => true,
        'data'    => array_map('app_admin_format_booking_row', $deduped),
    ];
}
```

---

### Issue #2: Couple Details Not Shown on Guest Row in Admin
**File:** `Last WP Plugin/headless-user-register/headless-user-register.php`  
**Location:** Line 5808 in `app_admin_format_booking_row()`  
**Current Behavior:** Only shows couple details when `isCoupleBooking=1`, but guest row gets its own card

**Why it happens:**
- Guest row (isGuestEntry=1) has couple details showing the host
- But these are shown in the same format as the primary booking
- Confusing because it's labeled as a "Couple Booking" but displays guest details

**Better approach:** Once deduplication is added, only host row appears, so this becomes moot.

---

### Issue #3: Frontend API Shows Attendees but Admin Doesn't
**File:** `Last WP Plugin/headless-user-register/headless-user-register.php`  
**Location:** Line 5880 in `app_admin_format_booking_row()`

**Current Code (for host row only):**
```php
$invitees = [];
$invite_stats = null;
if ($pair_code && empty($row['isGuestEntry'])) {  // ✅ Only for host
    $guest_rows = $wpdb->get_results(
        $wpdb->prepare("SELECT id, username, email, user_status FROM {$table} WHERE pair_code = %s AND isGuestEntry = 1 ...", $pair_code),
        ARRAY_A
    );
    // ... builds invitees array ...
}
```

**Issue:** Guest row (when returned separately) doesn't show host in attendees list

**Fix included when admin API is deduplicated:** Since only host row is returned, it will show attendees correctly

---

## 📊 DATA FLOW DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ USER CREATES COUPLE BOOKING (Ali + Fatima)                                 │
└────────────────────────┬────────────────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │  WordPress Post (event_booking)    │
        │  ID: 42                            │
        │  Meta: booking_is_couple=yes       │
        │  Meta: booking_couple_*            │
        └────────────────────┬───────────────┘
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
        ┌──────────────┐         ┌──────────────┐
        │  Custom Tbl  │         │  Custom Tbl  │
        │  Row 100     │         │  Row 101     │
        │ (Host: Ali)  │         │(Guest:Fat)   │
        │ isGuest=0    │         │ isGuest=1    │
        │ pair_code=   │◄───────►│ pair_code=   │
        │ 987654       │         │ 987654       │
        │ qr_id=QR001  │         │ qr_id=QR001  │
        └──────┬───────┘         └──────┬───────┘
               │                        │
        ┌──────┴────────┬───────────────┴──────────────┐
        ▼               ▼                              ▼
   
   ┌─────────────────────────────────────────────────────────────┐
   │ FRONTEND: /my-bookings Endpoint (events-api.php)           │
   │                                                             │
   │ ✅ Step 1: Fetch rows for logged-in user (Ali)            │
   │    → Gets Row 100 (host)                                   │
   │                                                             │
   │ ✅ Step 2: Find pair_codes from those rows                 │
   │    → Finds 987654                                          │
   │                                                             │
   │ ✅ Step 3: Fetch all rows with those pair_codes           │
   │    → Gets Row 101 (guest) as related row                  │
   │                                                             │
   │ ✅ Step 4: GROUP by pair_code (987654)                    │
   │    → Groups Row 100 + Row 101 together                     │
   │                                                             │
   │ ✅ Step 5: SELECT ONE per group (host: Row 100)          │
   │    → Returns only Row 100                                  │
   │                                                             │
   │ Result: 1 Card showing couple booking with attendees      │
   └─────────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Frontend Shows:      │
              │  1 Card per couple ✅ │
              │  Attendees: Ali, Fat  │
              └──────────────────────┘


   ┌─────────────────────────────────────────────────────────────┐
   │ ADMIN: /admin/bookings Endpoint (headless-user-register)   │
   │                                                             │
   │ ❌ Step 1: Fetch ALL rows from custom table               │
   │    → Gets Row 100 (host) + Row 101 (guest)                 │
   │                                                             │
   │ ❌ Step 2: Apply filters (NO deduplication)               │
   │    → Still returns both rows                               │
   │                                                             │
   │ ❌ Result: Both rows formatted and returned                │
   │                                                             │
   │ Problem: Returns 2 rows per couple booking                 │
   └─────────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  Admin Shows:        │
              │  2 Cards per couple❌ │
              │  (Host + Guest)      │
              │  Confusing display   │
              └──────────────────────┘
```

---

## 🛠️ RECOMMENDATION & PRIORITY

### Critical Issues
1. **Admin API returns 2 rows per couple** (Line 4548, headless-user-register.php)
   - Priority: **🔴 CRITICAL**
   - Impact: Admin sees incorrect booking count, duplicate cards
   - Fix: Add deduplication logic (copy from frontend API logic)

2. **Frontend displays all returned rows** (BookingsManagement component)
   - Priority: **🔴 CRITICAL**
   - Impact: Admin UI shows 2 separate cards per couple
   - Fix: Once API is fixed, UI will automatically show correct count

### Secondary Issues
3. **Inconsistent column documentation** 
   - `couple_name`, `couple_email` fields exist on BOTH rows
   - `invited_by_email` used to distinguish host/guest
   - Priority: 🟡 MEDIUM (document the design)

4. **WordPress post vs custom table mismatch**
   - 1 post vs 2 rows creates confusion
   - Priority: 🟡 MEDIUM (document why dual storage)

---

## 📝 COUPLES BOOKING FLAG USAGE

### Where `isCoupleBooking` is Set
- **Creation:** `Last WP Plugin/events-api/events-api.php` line 2160
  - Set to 1 when couple object is provided
  - Set to 1 on BOTH rows (host + guest)

### Where `isCoupleBooking` is Read/Used
1. **Frontend API** (line 2468): Shows in response data
2. **Admin UI Component**: Displays as "Couple Pass" in `getBookingPartyLabel()`
3. **Admin Format Function** (line 5808): Builds couple_details object

### Where `pair_code` is Used
1. **Couple Deduplication** (Frontend API): Groups rows
2. **Invite Response Handling** (events-api.php line 269): Updates both rows
3. **Admin Format Function** (line 5880): Fetches invitees for host row
4. **Email Sending**: Links rows for couple invitation emails

---

## 📋 VERIFICATION CHECKLIST

To confirm the issue in your database:

```sql
-- Find couple bookings with duplicate rows
SELECT pair_code, COUNT(*) as row_count, GROUP_CONCAT(id) as row_ids
FROM wp_usereventsbookings
WHERE isCoupleBooking = 1
GROUP BY pair_code
HAVING COUNT(*) > 1
LIMIT 10;

-- Example output:
-- pair_code | row_count | row_ids
-- 987654    | 2         | 100,101
-- 654321    | 2         | 102,103
```

If this query shows `row_count=2` for couple bookings, the issue is confirmed:
- ✅ **Frontend API** deduplicates correctly → User sees 1 card
- ❌ **Admin API** doesn't deduplicate → Admin sees 2 cards

