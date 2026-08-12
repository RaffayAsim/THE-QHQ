# Implementation Plan — Bulletproof Ticket QR Redirections, Expired Event Blocks & Manual User Passwords

This plan describes the proposed changes to the QHQ backend and frontend repositories to fix three key reported issues and improve overall system reliability.

---

## User Review Required

> [!IMPORTANT]
> **1. Manual Admin User Creation flow changes:**
> - When an administrator creates a user manually from the admin panel (`POST /admin/users`), if they do not provide a password, the backend will auto-generate a secure random 12-character password.
> - The new user will be sent a **premium branded welcome email** containing their username/email, their temporary password, and a direct button link to log in.
> - The generated password will also be returned directly in the REST API response (`password` field) so the admin panel can display it to the administrator immediately for manual sharing if needed.
>
> **2. Expiry checks on bookings, updates, and invitations:**
> - We will enforce a timezone-aware (`Asia/Karachi`) check verifying that the event date is not in the past during new booking creation, companion updates, and invitation approvals.
>
> **3. `/my-bookings` Card Deduplication Enhancement:**
> - Currently, `/my-bookings` groups results by `event_id` to prevent companion duplicates, which accidentally swallows different legitimate booking transactions for the same event. We will change the grouping key to use `pair_code` (if couple/group booking) or individual booking `id` (if single booking).

---

## Proposed Changes

### Component 1: `events-api` Plugin (Backend)

#### [MODIFY] [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)

##### 1. Block Booking Requests for Expired Events
* **Function:** `app_event_booking`
* **Change:** Fetch the raw event date meta (`event_date` or legacy `date`). Parse the date and, using Pakistan's `Asia/Karachi` timezone, compare it to the current day. If the event date has already passed, return a `400 Bad Request` error.
* **Code insertion location:** Directly below the `invalid_event` validation.
```php
    /* Expired Event Check */
    $event_date_raw = get_post_meta($event_id, 'event_date', true) ?: get_post_meta($event_id, 'date', true) ?: '';
    if ($event_date_raw) {
        if (preg_match('/^\d{8}$/', $event_date_raw)) {
            $event_date_parsed = substr($event_date_raw, 0, 4) . '-' . substr($event_date_raw, 4, 2) . '-' . substr($event_date_raw, 6, 2);
        } else {
            $event_date_parsed = $event_date_raw;
        }
        try {
            $tz = new DateTimeZone('Asia/Karachi');
            if (strtotime($event_date_parsed) !== false) {
                $event_date_dt = new DateTime($event_date_parsed . ' 23:59:59', $tz);
                $now_dt = new DateTime('now', $tz);
                if ($event_date_dt < $now_dt) {
                    return new WP_Error('event_expired', 'This event has expired. Booking requests for past events are not allowed.', ['status' => 400]);
                }
            }
        } catch (Exception $e) {
            // Ignore parse errors to prevent blocking valid bookings if date format is weird
        }
    }
```

##### 2. Block Companion Invitation Acceptances for Expired Events
* **Function:** `app_handle_invite_response`
* **Change:** Ensure that companion acceptances are rejected if the event has already expired, preventing late ticket confirmations.
```php
    // Expired Event Check
    if ($event_id > 0) {
        $event_date_raw = get_post_meta($event_id, 'event_date', true) ?: get_post_meta($event_id, 'date', true) ?: '';
        if ($event_date_raw) {
            if (preg_match('/^\d{8}$/', $event_date_raw)) {
                $event_date_parsed = substr($event_date_raw, 0, 4) . '-' . substr($event_date_raw, 4, 2) . '-' . substr($event_date_raw, 6, 2);
            } else {
                $event_date_parsed = $event_date_raw;
            }
            try {
                $tz = new DateTimeZone('Asia/Karachi');
                if (strtotime($event_date_parsed) !== false) {
                    $event_date_dt = new DateTime($event_date_parsed . ' 23:59:59', $tz);
                    $now_dt = new DateTime('now', $tz);
                    if ($event_date_dt < $now_dt) {
                        return new WP_Error('event_expired', 'This event has expired. You cannot process invitations for past events.', ['status' => 400]);
                    }
                }
            } catch (Exception $e) {
                // Ignore parse errors to prevent blocking
            }
        }
    }
```

##### 3. Block Companion Modification/Editing for Expired Events
* **Function:** `eapi_rest_update_booking_companion`
* **Change:** Reject companion details updates/corrections once the event date has expired.

##### 4. `/my-bookings` Deduplication Key Upgrade
* **Function:** `eapi_rest_get_my_bookings`
* **Change:** Update the grouping key from `event_id` to `pair_code` or booking `id` so that separate booking transactions for the same event are not combined/swallowed.
```php
    // Group and deduplicate results by pair_code (or row id) instead of event_id
    $grouped_bookings = [];
    foreach ($results_all as $row) {
        $pair_code = sanitize_text_field((string) ($row['pair_code'] ?? ''));
        $key = $pair_code !== '' ? 'pair_' . $pair_code : 'row_' . $row['id'];
        $grouped_bookings[$key][] = $row;
    }
```

---

### Component 2: `headless-user-register` Plugin (Backend)

#### [MODIFY] [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)

##### 1. Generate, Email, and Return Password on Manual User Creation
* **Function:** `app_admin_create_user`
* **Change:** Pre-generate a password if none is provided in `$params['password']`. Pass this exact password to `wp_insert_user()`. Dispatch a stylized welcome email to the created user with their login details. Return the generated password in the API response.
```php
    // Generate secure password if none is provided
    $raw_password = !empty($params['password']) ? trim($params['password']) : wp_generate_password(12, false);

    $user_id = wp_insert_user([
        'user_login'   => $username,
        'user_email'   => $email,
        'first_name'   => sanitize_text_field($params['first_name'] ?? ''),
        'last_name'    => sanitize_text_field($params['last_name'] ?? ''),
        'display_name' => sanitize_text_field($params['display_name'] ?? trim(($params['first_name'] ?? '') . ' ' . ($params['last_name'] ?? ''))),
        'user_pass'    => $raw_password,
        'role'         => $role,
    ]);
```
* **Welcome Email dispatch and password return in API response:**
```php
    // Dispatch stylized premium welcome email
    $login_url = app_get_frontend_base_url() . '/login';
    $display_name = sanitize_text_field($params['display_name'] ?? trim(($params['first_name'] ?? '') . ' ' . ($params['last_name'] ?? '')));
    if (empty($display_name)) {
        $display_name = $username;
    }

    $email_body = '
<div style="background:#f5f5f5; padding:30px; font-family:Arial, sans-serif;">
  <div style="text-align:center; margin-bottom:20px;">
    <img style="width:140px;" src="https://theqhq.com/assets/logo-7ZRf3d2G.png" />
  </div>
  <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid rgba(233,50,151,0.25); box-shadow:0 0 15px rgba(233,50,151,0.25);">
    <div style="background:#E93297; padding:20px; text-align:center;">
      <h2 style="color:#ffffff; margin:0; font-size:24px;">Welcome to QHQ</h2>
    </div>
    <div style="padding:25px; color:#333; font-size:15px; line-height:1.7;">
      <p>Hello ' . esc_html($display_name) . ',</p>
      <p>Your account has been created manually by the administrator. You can now log in using the details below:</p>
      <table role="presentation" cellspacing="0" cellpadding="10" border="0" style="width:100%; background:#f9f9f9; border-radius:8px; margin:15px 0;">
        <tr>
          <td style="width:120px; font-weight:bold; color:#555;">Email:</td>
          <td style="color:#333; font-family:monospace; font-size:16px;">' . esc_html($email) . '</td>
        </tr>
        <tr>
          <td style="font-weight:bold; color:#555;">Password:</td>
          <td style="color:#333; font-family:monospace; font-size:16px;">' . esc_html($raw_password) . '</td>
        </tr>
      </table>
      <p>Click the button below to log in and set up your profile:</p>
      <p style="text-align:center; margin:25px 0;">
        <a href="' . esc_url($login_url) . '" style="display:inline-block; background:#E93297; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:bold; letter-spacing:0.03em;">Login to My Account</a>
      </p>
      <p style="font-size:13px; color:#777;">For security reasons, we highly recommend changing your password after logging in for the first time.</p>
    </div>
  </div>
</div>';

    wp_mail($email, 'Your QHQ Account Details', $email_body, ['Content-Type: text/html; charset=UTF-8']);

    return [
        'success' => true,
        'message' => 'User created successfully.',
        'user_id' => $user_id,
        'password' => $raw_password, // Return so admin panel can display copy-button
    ];
```

---

### Component 3: Frontend (React Ticket Page)

#### [MODIFY] [WordPressTicketPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressTicketPage.tsx)

##### 1. Clean QR Redirect Payload Logic
* **Change:** Update `qrPayload` generation to utilize `window.location.origin` and the URL parameter `token` to construct the exact validation URL targeting the current site context (e.g. `http://localhost:8080/ticket/<token>` on local dev or the custom staging/production URL). This completely bypasses the fallback redirecting to the generic `https://theqhq.com` homepage.
* **Code replacement in `src/pages/WordPressTicketPage.tsx`:**
```typescript
  const qrPayload = useMemo(() => {
    const baseUrl = window.location.origin;
    const target = token ? `${baseUrl}/ticket/${token}` : String(payload?.ticket_url || window.location.href || "");
    return encodeURIComponent(target);
  }, [payload?.ticket_url, token]);
```

---

## Verification Plan

### Automated Tests
- Run TypeScript validations to verify the frontend compilation: `npx tsc --noEmit`.
- Rebuild the production assets using the Hostinger target: `npm run build:hostinger`.
- Pack the updated backend plugins into zip files (`events-api.zip`, `headless-user-register.zip`).

### Manual Verification
1. **Expired Event Booking Blocks:**
   - Attempt to book an event with a date in the past (e.g. `2026-05-26`). Verify that the booking request is blocked with the error `This event has expired.`.
   - Attempt to accept an invitation for an expired event. Verify it is rejected.
2. **QR Code Verification:**
   - Load the ticket page `/ticket/<token>`.
   - Scan the QR code using a mobile phone. Verify that the scanner redirects to the exact `/ticket/<token>` validation URL of the loaded environment (e.g. `http://localhost:8080/ticket/<token>` or the custom site domain) rather than generic `https://theqhq.com`.
3. **Manual Admin User Password Setup:**
   - Submit a request to create a user manually.
   - Verify that the response returns the auto-generated password and that a styled HTML email is sent with login credentials.
