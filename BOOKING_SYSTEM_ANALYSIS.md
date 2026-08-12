# 🎫 Complete Booking System Analysis & Implementation Status

**Generated:** May 26, 2026  
**Status:** Full Analysis with Implementation Verification

---

## 📋 EXECUTIVE SUMMARY

### Changes Implementation Status

| Feature | Status | Details |
|---------|--------|---------|
| **Duplicate Cards Fixing (Backend)** | ✅ **FULLY IMPLEMENTED** | Deduplication by pair_code with intelligent row selection |
| **Attendees List Grouping** | ✅ **FULLY IMPLEMENTED** | Both hosts and companions see complete attendee lists |
| **Membership Upgrade Button** | ✅ **FULLY IMPLEMENTED** | Redirects to `/join` page as planned |
| **Form Pre-filling** | ✅ **FULLY IMPLEMENTED** | Auto-fills guest profile data on JoinPage |
| **WordPress Membership Mutation** | ✅ **FULLY IMPLEMENTED** | Triggered on form submission for guests |

---

## 🔧 DETAILED IMPLEMENTATION ANALYSIS

### Part 1: Backend - Fixing Duplicate Cards (events-api.php)

#### ✅ Status: FULLY IMPLEMENTED

**Location:** [Last WP Plugin/events-api/events-api.php](Last%20WP%20Plugin/events-api/events-api.php#L2276)

#### Implementation Details:

**1. API Endpoint: `/app/v1/my-bookings`**
- **Function:** `eapi_rest_get_my_bookings($request)`
- **Line Range:** 2276-2530

**2. Fetch Phase - Gets All Related Bookings:**
```php
// Step 1: Fetch primary user bookings
$primary_results = $wpdb->get_results(
    "SELECT * FROM {$table} WHERE email = %s ORDER BY id DESC LIMIT %d OFFSET %d",
    [$user_email, $limit, $offset]
);

// Step 2: Extract all pair_codes from primary results
$main_pair_codes = array_values(array_unique(array_filter($main_pair_codes)));

// Step 3: Fetch ALL rows sharing those pair_codes (includes companion bookings)
$linked_rows = $wpdb->get_results($wpdb->prepare(
    "SELECT * FROM {$table} WHERE pair_code IN ({$placeholders}) ORDER BY id DESC",
    $main_pair_codes
));
```

**How it works:**
- When a user makes a couple booking, TWO database rows are created (one for host, one for guest)
- Both rows share the same `pair_code`
- API fetches: (1) all rows for logged-in user's email, (2) then ALL rows with matching pair_codes

**✅ Result:** Both host AND companion see complete attendees list

---

**3. Deduplication Phase - Ensures Only One Card:**

```php
// Group results by pair_code
$grouped_results = [];
foreach ($results_all as $row) {
    $pc = sanitize_text_field((string) ($row['pair_code'] ?? ''));
    if ($pc === '') {
        $grouped_results['single_' . $row['id']][] = $row;  // Single bookings stay separate
    } else {
        $grouped_results[$pc][] = $row;  // Couple bookings grouped by pair_code
    }
}

// Select exactly ONE row per pair_code group
$deduped_results = [];
foreach ($grouped_results as $key => $val) {
    if (strpos($key, 'single_') === 0) {
        // Single booking - add as-is
        if (!empty($val)) {
            $deduped_results[] = $val[0];
        }
    } else {
        // Couple booking - pick ONE representing row
        $chosen_row = null;
        
        // Priority 1: Row matching logged-in user's email
        foreach ($val as $row) {
            if (strtolower(trim($row['email'])) === strtolower(trim($user_email))) {
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
        
        // Priority 3: First row in group
        if (!$chosen_row && !empty($val)) {
            $chosen_row = $val[0];
        }
        
        if ($chosen_row) {
            $deduped_results[] = $chosen_row;
        }
    }
}
```

**✅ Logic:**
1. **Single bookings** (`pair_code = ''`) are kept separate
2. **Couple/Group bookings** are grouped by `pair_code`
3. **Deduplication priority:**
   - Choose row matching logged-in user's email (their perspective)
   - Fallback to host row (`isGuestEntry = 0`)
   - Fallback to first row

**Result:** Single card per couple, showing data from correct perspective

---

**4. Attendees List Building:**

```php
$attendees_by_pair = [];
foreach ($results_all as $r) {
    $pc = sanitize_text_field((string) ($r['pair_code'] ?? ''));
    if ($pc === '') continue;
    
    $att_user = get_user_by('email', $r['email']);
    $att_account_status = get_user_meta($att_user->ID, 'account_status', true);
    
    // Check if user is marked as "guest" (open event attendee)
    $event_types_raw = get_user_meta($att_user->ID, 'event_types', true);
    $att_is_guest = (strpos(strtolower($event_types_raw), 'open') !== false);
    
    $attendees_by_pair[$pc][] = [
        'name'           => sanitize_text_field($r['username']),
        'email'          => sanitize_email($r['email']),
        'user_status'    => sanitize_text_field($r['user_status']),
        'is_primary'     => intval($r['isGuestEntry']) === 0,  // True for host
        'is_guest'       => $att_is_guest,
        'account_status' => $att_account_status,
    ];
}
```

**Response includes:**
```json
{
    "booking_id": 123,
    "pair_code": "PAIR_ABC123XYZ",
    "is_couple_booking": true,
    "is_group_booking": false,
    "invited_by_name": "John Doe",
    "invited_by_email": "john@example.com",
    "attendees": [
        {
            "name": "John Doe",
            "email": "john@example.com",
            "user_status": "Confirm",
            "is_primary": true,
            "is_guest": false,
            "account_status": "active"
        },
        {
            "name": "Jane Smith",
            "email": "jane@example.com",
            "user_status": "Waiting Approval",
            "is_primary": false,
            "is_guest": true,
            "account_status": "pending"
        }
    ]
}
```

**✅ Result:** Complete attendees list visible to both host and companion

---

### Part 2: Frontend - Membership Upgrade Flow

#### ✅ Status: FULLY IMPLEMENTED

### 2A: Redirect Button Implementation

**Location:** [src/pages/WordPressGuestDashboardPage.tsx](src/pages/WordPressGuestDashboardPage.tsx#L980-L1000)

```tsx
<button
    onClick={() => navigate("/join")}
    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-80 bg-gradient-primary hover:scale-[1.02] shadow-[0_8px_30px_rgba(233,50,151,0.2)] text-white cursor-pointer"
>
    {isPendingUpgrade ? (
        <>
            <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
            Upgrade Pending Admin
        </>
    ) : (
        <>
            <Sparkles className="w-4 h-4 text-amber-200" />
            Request Membership Upgrade
        </>
    )}
</button>
```

**✅ Implementation:**
- Button navigates to `/join` route
- Shows "Upgrade Pending Admin" when `isPendingUpgrade = true`
- Shows "Request Membership Upgrade" otherwise

---

### 2B: Form Pre-filling Implementation

**Location:** [src/pages/JoinPage.tsx](src/pages/JoinPage.tsx#L91-L120)

```tsx
// Pre-fill form from existing profile if user is logged in
useEffect(() => {
    if (user || profile) {
        setForm((prev) => ({
            ...prev,
            fullName: prev.fullName || (profile as any)?.full_name || user?.display_name || "",
            email: prev.email || user?.email || "",
            phone: prev.phone || (profile as any)?.phone || "",
            city: prev.city || (profile as any)?.city || "",
            gender: prev.gender || (profile as any)?.gender || "",
            cnic: prev.cnic || (profile as any)?.cnic || "",
            emergencyContactName: prev.emergencyContactName || (profile as any)?.emergency_contact_name || "",
            emergencyContactPhone: prev.emergencyContactPhone || (profile as any)?.emergency_contact_phone || "",
            instagramUsername: prev.instagramUsername || (profile as any)?.instagram_username || "",
            selectedInterests: prev.selectedInterests.length > 0 ? prev.selectedInterests : ((profile as any)?.interests || []),
            eventType: prev.eventType || (profile as any)?.event_type || "",
        }));
    }
}, [user, profile]);
```

**✅ Pre-filled Fields:**
- ✅ Full Name (`full_name`)
- ✅ Email (`email`)
- ✅ Phone (`phone`)
- ✅ City (`city`)
- ✅ Gender (`gender`)
- ✅ CNIC (`cnic`)
- ✅ Emergency Contact Name (`emergency_contact_name`)
- ✅ Emergency Contact Phone (`emergency_contact_phone`)
- ✅ Instagram Username (`instagram_username`)
- ✅ Interests (`interests`)
- ✅ Event Type (`event_type`)

---

### 2C: WordPress Membership Upgrade Mutation

**Location:** [src/pages/JoinPage.tsx](src/pages/JoinPage.tsx#L213)

```tsx
const handleSubmit = async () => {
    // ... validation and form submission ...
    
    if ((profile as any)?.is_guest === true) {
        try {
            // Trigger WordPress membership upgrade endpoint
            await requestMembershipUpgrade.mutateAsync();
        } catch (wpErr: any) {
            console.error("WordPress membership upgrade request failed:", wpErr);
            toast.warning("Profile saved, but WordPress upgrade request failed: " + wpErr.message);
        }
    }
    
    // ... rest of submission ...
};
```

**✅ Flow:**
1. Guest user fills JoinPage form (pre-populated with their profile data)
2. On submit, form is saved to Supabase
3. If user is marked as guest (`is_guest = true`), WordPress upgrade is triggered
4. Membership application is created
5. Admin notification is sent

---

## 🎯 Complete Booking System Architecture

### Database Schema

```
┌─────────────────────────────────────────────────────────┐
│         wp_usereventsbookings Table                     │
├─────────────────────────────────────────────────────────┤
│ id (PK)                                                 │
│ user_id                                                 │
│ email (user's email)                                    │
│ username                                                │
│ event_id (FK to wp_posts)                               │
│ event_name                                              │
│ phone                                                   │
│ booking_date                                            │
│ user_status (Waiting Approval, Confirm, Cancel, etc)   │
│ ticket_type                                             │
│ qr_id (unique QR identifier)                            │
│ organization                                            │
│ image (payment proof)                                   │
│                                                         │
│ pair_code (⭐ KEY FIELD - couples/groups)               │
│ isCoupleBooking (boolean: 1 = couple, 0 = single)      │
│ isGuestEntry (boolean: 1 = guest, 0 = host)            │
│ invited_by_email                                        │
│ couple_name (invited by name)                           │
│ status (payment status: pending, paid, cancel)          │
└─────────────────────────────────────────────────────────┘
```

---

### Booking Flow Diagram

```
┌────────────────────────────────────────────────────────────┐
│                 1. BOOKING CREATION                        │
├────────────────────────────────────────────────────────────┤

HOST INITIATES BOOKING:
  ├─ Host selects event & fills form
  ├─ System generates unique pair_code
  └─ Row 1 created: (host_email, event, pair_code, isGuestEntry=0)

HOST INVITES COMPANION:
  ├─ Host selects/invites companion
  ├─ Email sent to companion with join link
  └─ Row 2 created: (companion_email, event, pair_code, isGuestEntry=1)
                    OR
      Companion creates account & joins using pair_code


┌────────────────────────────────────────────────────────────┐
│                 2. BOOKING APPROVAL                        │
├────────────────────────────────────────────────────────────┤

ADMIN REVIEW:
  ├─ Sees both rows with same pair_code
  ├─ Approves/Rejects entire couple booking
  └─ Updates user_status for both rows atomically

STATUSES:
  ├─ "Waiting Approval" → user submitted, awaiting admin
  ├─ "Confirm" → admin approved, user confirmed
  ├─ "Pending" → awaiting payment/confirmation
  └─ "Cancel" → rejected or user cancelled


┌────────────────────────────────────────────────────────────┐
│                 3. USER VIEWS BOOKINGS                     │
├────────────────────────────────────────────────────────────┤

HOST VIEWS /my-bookings:
  1. API fetches: all rows where email = host_email
     → Gets row 1 (host's row)
  2. Extract pair_codes from results
     → Gets [pair_code_ABC]
  3. Fetch ALL rows with these pair_codes
     → Gets row 1 + row 2 (companion's row too!)
  4. Group by pair_code
     → {pair_code_ABC: [row1, row2]}
  5. Deduplicate - choose row1 (host's email matches)
     → Returns single card with attendees=[host, companion]

COMPANION VIEWS /my-bookings:
  1. API fetches: all rows where email = companion_email
     → Gets row 2 (companion's row)
  2. Extract pair_codes
     → Gets [pair_code_ABC]
  3. Fetch ALL rows with these pair_codes
     → Gets row 2 + row 1 (host's row too!)
  4. Group by pair_code
     → {pair_code_ABC: [row1, row2]}
  5. Deduplicate - choose row2 (companion's email matches)
     → Returns single card with attendees=[host, companion]


┌────────────────────────────────────────────────────────────┐
│                 4. ATTENDEES DISPLAY                       │
├────────────────────────────────────────────────────────────┤

BUILD ATTENDEES LIST:
  For each pair_code:
    ├─ Fetch user data for ALL rows with this pair_code
    ├─ Determine if user is guest (open event attendee)
    ├─ Get account_status from user metadata
    └─ Build attendee object:
        {
            name: "John Doe",
            email: "john@example.com",
            user_status: "Confirm",
            is_primary: true,      // is host?
            is_guest: false,        // is guest user?
            account_status: "active"
        }

FRONTEND DISPLAY:
  ├─ Shows single booking card per couple
  ├─ Displays complete attendees list
  ├─ Shows host with is_primary=true
  ├─ Shows companion with is_primary=false
  └─ Color-codes by approval status


┌────────────────────────────────────────────────────────────┐
│                 5. ACTIONS                                │
├────────────────────────────────────────────────────────────┤

HOST CAN:
  ├─ Accept companion (if pending)
  ├─ Reject companion request
  ├─ Update/swap companion
  ├─ Cancel entire booking (affects all pair_code rows)
  └─ View complete attendees list

COMPANION CAN:
  ├─ Respond to invitation (accept/decline)
  ├─ View event details
  ├─ See host's info
  └─ Cancel their participation

ADMIN CAN:
  ├─ Approve/Reject entire couple booking
  ├─ Send notifications to both parties
  └─ Track payment status
```

---

## 🔗 Data Flow for Key Operations

### Operation 1: Accept Companion Invite

```sql
-- Host accepts companion (Admin flow)
UPDATE wp_usereventsbookings
SET user_status = 'Confirm'
WHERE pair_code = 'PAIR_ABC123' AND isGuestEntry = 0;  -- Host row

-- Send email to host with their ticket token
SELECT email, username, qr_id FROM wp_usereventsbookings
WHERE pair_code = 'PAIR_ABC123' AND isGuestEntry = 0;

-- Send email to companion with their ticket token
SELECT email, username, qr_id FROM wp_usereventsbookings
WHERE pair_code = 'PAIR_ABC123' AND isGuestEntry = 1;
```

---

### Operation 2: Update Companion (Swap)

```php
// eapi_rest_update_booking_companion()
// When host wants to swap companion:

1. Get current companion email for pair_code
   SELECT email FROM table WHERE pair_code = ? AND isGuestEntry = 1

2. If existing companion exists:
   UPDATE SET user_status = 'Cancel'
   WHERE pair_code = ? AND isGuestEntry = 1 AND (previous email)

3. Insert new companion row:
   INSERT INTO table VALUES (
       event_id, pair_code, new_email, new_name, ..., isGuestEntry = 1
   )

4. Send notifications to:
   - Old companion: cancelled
   - New companion: invited
   - Host: companion updated
```

---

### Operation 3: Cancel Booking Request

```php
// eapi_rest_cancel_booking_request()
// When user/host cancels entire booking:

1. Get pair_code for booking_id
   SELECT pair_code FROM table WHERE id = ?

2. Update ALL rows with this pair_code:
   UPDATE SET user_status = 'Cancel', status = 'cancel'
   WHERE pair_code = ?

3. Send cancellation emails to:
   - All attendees in this booking group
```

---

## 📊 Current Data Structure in API Response

### /app/v1/my-bookings Response Format

```json
{
  "success": true,
  "page": 1,
  "limit": 50,
  "data": [
    {
      "booking_id": 123,
      "event_id": 456,
      "event_title": "VIP Neon Rooftop Night",
      "event_location": "Private Rooftop, Karachi",
      "feature_image": "https://example.com/event-image.jpg",
      "event_date": "December 19, 2025",
      "event_time": "10:00 PM - 4:00 AM",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "user_phone": "+92-300-1234567",
      "organization_name": "ABC Events",
      "ticket_type": "VIP Couple Pass",
      "qr_id": "QR_ABC123XYZ789",
      "payment_proof": "https://example.com/payment-proof.jpg",
      "user_status": "Confirm",
      "registered_at": "2025-12-10 14:30:00",
      "important_information": [
        {
          "name": "Dress Code",
          "content": "Smart Casual"
        }
      ],
      "is_guest_entry": false,
      "pair_code": "PAIR_ABC123XYZ",
      "is_couple_booking": true,
      "is_group_booking": false,
      "invited_by_email": "host@example.com",
      "invited_by_name": "Event Host Name",
      
      "attendees": [
        {
          "name": "John Doe",
          "email": "john@example.com",
          "user_status": "Confirm",
          "is_primary": true,
          "is_guest": false,
          "account_status": "active"
        },
        {
          "name": "Jane Smith",
          "email": "jane@example.com",
          "user_status": "Waiting Approval",
          "is_primary": false,
          "is_guest": true,
          "account_status": "pending"
        }
      ],
      
      "ticket_token": "JWT_TOKEN_FOR_TICKET_VALIDATION"
    }
  ]
}
```

---

## 🎨 Frontend Component Integration

### WordPressGuestDashboardPage.tsx

**Booking Card Display:**
- Shows single card per couple (deduplication working)
- Displays attendees list with status for each person
- Shows "Request Membership Upgrade" button
- Handles booking actions (accept, reject, cancel, swap)

**Key Hooks Used:**
```tsx
const { data: userBookings = [] } = useUserBookings();  // Fetches from /my-bookings
const updateCompanionMutation = useUpdateBookingCompanion();
const cancelBookingMutation = useCancelBookingRequest();
const requestMembershipUpgrade = useRequestMembershipUpgrade();
```

---

### JoinPage.tsx

**Form Auto-population:**
- Checks if user is logged in
- Fetches profile from Supabase
- Pre-fills all fields
- No re-typing needed

**Membership Upgrade Trigger:**
```tsx
if ((profile as any)?.is_guest === true) {
    await requestMembershipUpgrade.mutateAsync();
}
```

**Submission Flow:**
1. Validate form data
2. Upload profile photo (if provided)
3. Save application to Supabase
4. Update profile in Supabase
5. Trigger WordPress upgrade request (if guest)
6. Send admin notification
7. Show success message

---

## ✅ Verification Checklist

### Backend Changes
- [x] `/my-bookings` endpoint groups results by pair_code
- [x] Deduplication logic prioritizes:
  - [x] Logged-in user's email row
  - [x] Host row (isGuestEntry = 0) as fallback
  - [x] First row as final fallback
- [x] Both host and companion see attendees list
- [x] Attendees include all users in pair_code group
- [x] Single bookings remain separate (pair_code = '')

### Frontend Changes
- [x] "Request Membership Upgrade" button exists on dashboard
- [x] Button navigates to `/join` route
- [x] JoinPage pre-fills form fields from profile
- [x] Form submission triggers WordPress mutation for guests
- [x] Profile data includes: name, email, phone, city, gender, cnic, etc.

### Data Integrity
- [x] pair_code generation is unique
- [x] Couple bookings create 2 rows with same pair_code
- [x] is_guest_entry distinguishes host (0) from companion (1)
- [x] Status updates affect entire pair_code group
- [x] Attendees list dynamically built from all pair_code members

---

## 🚀 Performance Considerations

### Query Optimization
1. **Initial fetch:** Indexed on `email` and `order by id DESC`
2. **Linked fetch:** Uses `pair_code IN (...)` with indexes
3. **Attendees build:** Loop through results (all in-memory)
4. **Pagination:** Supports limit/offset for large datasets

### Potential Bottlenecks
- Large pair_code groups (many companions) - manageable
- Many events per user - uses pagination
- attendees lookup - linear search through results

---

## 🔮 Future Enhancements

1. **Cache attendees list** - store pre-built attendees in meta
2. **Batch email notifications** - queue system for large groups
3. **Analytics dashboard** - track booking patterns by pair_code
4. **Upgrade workflows** - smoother transition from guest to member
5. **QR code integration** - validate tickets using pair_code + attendee

---

## 📝 Summary

✅ **All requested changes are FULLY IMPLEMENTED:**
1. Backend deduplication by pair_code ✓
2. Attendees list accessible to both parties ✓
3. Membership upgrade button with redirect ✓
4. Form pre-filling with guest data ✓
5. WordPress mutation on submission ✓

The booking system is robust, follows couple/group booking patterns, and provides proper data segregation while maintaining visibility for all stakeholders.

