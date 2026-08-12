# Comprehensive Engagement Changelog & Security Upgrades

This document provides a detailed log of all modifications, security audits, logic improvements, and user experience enhancements implemented across your codebase. These upgrades harden security, fix legacy bugs, ensure booking integrity, and deliver robust staging environment routing.

---

## Table of Contents
1. [Sprint 1: Security Hardening & Data Exposure Prevention](#1-sprint-1-security-hardening--data-exposure-prevention)
2. [Sprint 2: Booking Exclusivity, Deduplication, & Integrity](#2-sprint-2-booking-exclusivity-deduplication--integrity)
3. [Sprint 3: Password Security & Timing-Safe Recovery Flows](#3-sprint-3-password-security--timing-safe-recovery-flows)
4. [Sprint 4: Code Cleanup, Safeguards, & Core Deprecations](#4-sprint-4-code-cleanup-safeguards--core-deprecations)
5. [Sprint 5: Staging Redirection, In-Dashboard Invitations, & Swap Constraints](#5-sprint-5-staging-redirection-in-dashboard-invitations--swap-constraints)
6. [Frontend & Packaging Build Verification](#6-frontend--packaging-build-verification)

---

## 1. Sprint 1: Security Hardening & Data Exposure Prevention
Focuses on stopping data leakage, securing user credentials, and closing debug endpoints on production.

*   **Task 1: Removed Private Booking Metadata from Public QR Verification**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Removed the raw `booking_raw` dump containing sensitive database structure and internal post fields from the `/getQrDetails` JSON API response.
*   **Task 2: Deactivated the Debug Auth Endpoint**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Completely disabled/removed the `/auth-debug` route to prevent potential diagnostic bypasses.
*   **Task 3: Prevented Cleartext Password Exposure in User Creation Responses**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Modified `app_admin_create_user` to omit returning `'password' => $raw_password` in cleartext via JSON. Instead, returns a secure flag: `'password_emailed' => true`.
*   **Task 4: Removed Harmful Password Sanitization**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Removed `sanitize_text_field()` on passwords during user registration and login. Sanitizing passwords strips special characters (like `<`, `>`, `&`), corrupting user secrets and artificially weakening security.

---

## 2. Sprint 2: Booking Exclusivity, Deduplication, & Integrity
Enforces data validity and prevents race conditions or duplicate bookings for events.

*   **Task 5: Relocated CNIC Sanitization & Validation Helpers**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Moved `eapi_validate_cnic()` to a dedicated top-level helpers block to make it reusable across all API routes.
*   **Task 6: Implemented Multi-Layer Exclusivity Checks**
    *   **Files:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php), [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Prevented double-booking scenarios. If a user is registered or pending (or has an unaccepted invite) for an event, they are blocked from making another booking or being added as a couple companion until their previous request is declined.
        *   Secured `app_event_booking` (booking creation).
        *   Secured `app_handle_invite_response` (accepting an invitation).
        *   Secured `eapi_rest_update_booking_companion` (companion swapping).
*   **Task 7: Repaired My-Bookings Grouping & Deduplication**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Replaced the fragile `event_id` grouping inside `/my-bookings` with unique `pair_code` or individual `id` grouping. This prevents multiple separate bookings for the same event from being erroneously merged into a single dashboard card.
*   **Task 8: Fixed Email Type Terminology**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Fixed a copy-paste error where status transition email templates used "solo" wording for couple bookings.
*   **Task 9: Cryptographically Secure Random String Generation**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Upgraded `generate_couple_pair_code()` and `generate_unique_qr_id()` to use timing-safe and secure random byte pools (`wp_rand()`) rather than simple `rand()`.
*   **Task 10: Soft-Lock Safeguard for Rejected Users**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Ensured that profiles rejected by admin are not permanently deleted from the database. Instead, they are soft-locked (cannot authenticate), preserving historic transaction logs.
*   **Task 11: Removed Dead Code**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Cleaned up unused, un-routed duplication methods like `eapi_rest_create_booking()`.
*   **Task 12: Added Numeric Suffixes to Duplicate Usernames**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Modified `app_admin_create_user` to automatically append a numeric suffix (e.g. `john_1`, `john_2`) if the primary username matches an existing user.

---

## 3. Sprint 3: Password Security & Timing-Safe Recovery Flows
Hardens the recovery pathways against timing attacks, brute force, and credential stuffing.

*   **Task 13: Implemented Secure Password Change Endpoint**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Added `POST /app/v1/change-password`. It verifies the existing password, applies validation checks, updates the hash in WP securely, invalidates active JWTs, and sends a secure confirmation email.
*   **Tasks 14-16: Hardened Password Reset Security**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Added a brute force lockout meta tracker. If a user fails to enter their reset password code 5 consecutive times, they are locked out. Changed reset URLs to route to the frontend base URL. Implemented timing-safe code validation via `hash_equals()`.
*   **Task 17: Added Language Context to Group Invitations**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Added an `$is_group` context flag to email templates so group booking companion invitations don't display romantic "couple" language.
*   **Task 18: Automatic Welcome Emails for Manual Registrations**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Triggered automatic welcome emails for users registered manually by admins inside `app_admin_manual_create_user_and_assign_ticket`.
*   **Task 19: Centralized Guest Match Helper**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Hardened `eapi_is_user_guest()` to perform exact case-insensitive matches instead of insecure, fragile substring checking.
*   **Task 20: Replaced Deprecated Functions**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Replaced deprecated `get_page_by_title()` calls with secure `WP_Query` lookups.

---

## 4. Sprint 4: Code Cleanup, Safeguards, & Core Deprecations
Removes legacy errors, simplifies API response formats, and protects transaction history.

*   **Task 21: Standardized `is_guest` Checks**
    *   **File:** [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php)
    *   **Action:** Replaced disparate, local copy-pasted `is_guest` validations across files with the centralized `eapi_is_user_guest()` method.
*   **Task 22: Removed Verbose Logs**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Stripped debugging `error_log()` dumps of credentials.
*   **Task 23: Cascading Cancellation Hooks**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Integrated post status updates so if a primary host cancels their couple/group booking, all companion rows are automatically synchronized and marked as canceled as well.
*   **Task 24: Added Null-Coalescing Logic**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Added null safeguards for `email` and `password` inside `app_user_login` to block fatal runtime errors when parameters are omitted.
*   **Task 25: Frontend Forgot Password UI Integration**
    *   **File:** [WordPressAuthPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressAuthPage.tsx)
    *   **Action:** Cleanly integrated the Forgot Password visual flow into the frontend login cards.
*   **Task 26: Staging Gmail SMTP Configuration**
    *   **File:** [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Overrode `option_wp_mail_smtp` dynamically in memory to direct staging outbound emails over a custom SSL Gmail SMTP flow, bypassing Brevo API expiration and unauthorized IP restrictions.

---

## 5. Sprint 5: Staging Redirection, In-Dashboard Invitations, & Swap Constraints
Optimizes companion user experience, secures dashboard actions, and ensures staging environment isolation.

*   **Task 27: Dynamic Staging Environment Detection & Redirections**
    *   **Files:**
        *   [events-api.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/events-api/events-api.php) (`eapi_get_public_frontend_url`)
        *   [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php) (`app_get_frontend_base_url`)
        *   [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php) (log-in link)
    *   **Action:** Implemented dynamic detection for the `quantumarc.us` domain. If detected in `site_url()`, `home_url()`, or `$_SERVER['HTTP_HOST']`, the base URL fallback dynamically updates to `https://qhq.quantumarc.us` instead of production `https://theqhq.com`.
*   **Task 28: Inline Invitation Response Dashboard Controls**
    *   **Files:**
        *   [WordPressGuestDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressGuestDashboardPage.tsx)
        *   [WordPressDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressDashboardPage.tsx)
    *   **Action:** Added **Accept** and **Decline** action button controls directly onto the companion's pending booking card under "My Booking Requests". This gives companions a highly visible, frictionless way to confirm or reject their invitations directly from their portal screen.
*   **Task 29: Restricted Swap Companion Option to Booking Host**
    *   **Files:**
        *   [WordPressGuestDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressGuestDashboardPage.tsx)
        *   [WordPressDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressDashboardPage.tsx)
    *   **Action:** Added an `isCurrentUserHost` role validator mapping in the dashboard. The **Swap** companion button is now exclusively rendered for the original host (primary booker) next to pending invitees. It is completely hidden from non-host companions, preventing layout errors or permission failures.

---

## 6. Sprint 6: Companion Swap, Real-Time Badges, Host Ticket & Gamification Fallbacks
Focuses on resolving UI edge cases, providing better companion status visibility, showing booking hosts on tickets, and establishing a bulletproof points fallback.

*   **Task 31: Fixed Swap Modal Event-Matching Type Mismatch**
    *   **Files:** [WordPressDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressDashboardPage.tsx), [WordPressGuestDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressGuestDashboardPage.tsx)
    *   **Action:** Upgraded `swapEvent` memo and `openSwapModal` to convert both event IDs and booking event IDs to strings (`String(e.id) === String(...)`) during lookups. This eliminated integer-vs-string strict equality mismatches, ensuring that members-only events are correctly detected and that the "New Guest" tab is hidden dynamically.
*   **Task 32: Differentiated Status Badges for Invitation States**
    *   **Files:** [WordPressDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressDashboardPage.tsx), [WordPressGuestDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressGuestDashboardPage.tsx)
    *   **Action:** Rewrote the booking request status parser. Instead of labeling both unaccepted and accepted states as a generic "Pending" badge, we now display an amber `"Waiting Partner"` badge if companions are still deciding, and an indigo `"Pending Admin"` badge once all partners have accepted, making status transitions transparent.
*   **Task 33: Consolidated Couple & Group Attendees into a Single Ticket Page Display**
    *   **Files:** [WordPressTicketPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressTicketPage.tsx), [headless-user-register.php](file:///c:/Users/dell/dyad-apps/Portal/Last%20WP%20Plugin/headless-user-register/headless-user-register.php)
    *   **Action:** Modified `app_get_ticket_details` in the backend to query all database rows sharing the same booking `pair_code` and return them as a unified `attendees` list. Rewrote `WordPressTicketPage.tsx` to automatically render all confirmed and pending companions together in a beautifully styled grid card rather than showing a single host's name, eliminating any guest name mismatch concerns.
    *   **Scanner Update:** Upgraded `app_scanner_scan_ticket` to automatically check in all confirmed members of the couple/group booking bundle simultaneously during a single scan, preventing redundant scan errors at the gate.
*   **Task 34: High-Fidelity Gamification Fallback & Streaks**
    *   **Files:** [useRewardsData.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/hooks/useRewardsData.tsx), [WordPressDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressDashboardPage.tsx)
    *   **Action:** Re-engineered the `useUserRewards` hook. Added a parallel local query fetching WordPress user bookings. Computed dynamic fallback points, XP, tiers, badges, and streaks entirely client-side. Merged these values with Supabase data, taking the maximum of the two to guarantee instant stats updates in the HUD. Fed `streakDays` correctly to `GamificationHUD` on the main dashboard.
*   **Task 35: Sandbox Payment Simulation Merchant**
    *   **Files:** [WordPressDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressDashboardPage.tsx), [WordPressGuestDashboardPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressGuestDashboardPage.tsx)
    *   **Action:** Injected a premium `"💳 Simulate Sandbox Payment"` button right next to the Payment Screenshot upload field in both Member and Guest dashboards. Clicking this button automatically generates a beautiful checkmarked Sandbox checkout receipt in Base64 SVG format, instantly filling the payment receipt screenshot requirement and allowing quick end-to-end sandbox booking testing.

---

## 7. Frontend & Packaging Build Verification

All changes were successfully verified, built, and packaged locally into final ZIP deployment archives:

*   **React Frontend Compilation:**
    *   Command: `npm run build:hostinger`
    *   Result: Successfully compiled and bundle ready in the `dist` folder.
*   **Plugin & Asset Archives:**
    *   `events-api.zip`: Bundled contents of the `Last WP Plugin/events-api` directory.
    *   `headless-user-register.zip`: Bundled contents of the `Last WP Plugin/headless-user-register` directory.
    *   `qhqdist.zip`: Bundled frontend production assets from the `dist` directory.

---

## 8. Sprint 17: Instant Guest-to-Member Upgrades & Cache Syncing
Focuses on updating the administrative portal to immediately reflect role updates inside UI listings without manual page reloading or log-outs.

*   **Task 91: Implemented Optimistic Cache Update Helper**
    *   **File:** [WordPressAdminPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressAdminPage.tsx)
    *   **Action:** Created `applyUpgradeToMemberOptimistically` which cancels background React Query refetches, modifies the cached `["wp-users"]` listing data instantly, and updates local states (`selectedUser` and `selectedUserData`) if the details modal is open.
*   **Task 92: Refactored Row-Level and Modal Action Handlers**
    *   **File:** [WordPressAdminPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressAdminPage.tsx)
    *   **Action:** Removed race-condition prone post-mutation `refetchUsers()` triggers, replacing them with the new optimistic helper to guarantee instantaneous UI transitions across tabs.
*   **Task 93: Removed Generic Mutator Toasts**
    *   **File:** [useWordPressData.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/hooks/useWordPressData.tsx)
    *   **Action:** Removed generic success alerts from `useUpdateWordPressUser` to allow callers to define clean context-specific feedback.

---

## 9. Sprint 18: Simplified Admin Blog Post Editor
Removes redundant, confusing, and unused options (Slug, Categories, Tags, Publish Date) from the admin panel dialog to provide a clean, user-friendly editor, while preserving the Excerpt field for manual summaries.

*   **Task 96: Simplified State and Data Interface**
    *   **File:** [WordPressAdminPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressAdminPage.tsx)
    *   **Action:** Refactored the `WordPressPostData` state model to only focus on `title`, `excerpt` (client custom summary), `content`, `status`, and `feature_image`. Refactored `openCreatePost` and `openEditPost` to initialize and map only these 5 user-facing properties.
*   **Task 97: Simplified Save Payload**
    *   **File:** [WordPressAdminPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressAdminPage.tsx)
    *   **Action:** Updated `savePost` to only transmit the 5 core properties in the request payload. Omitted `slug`, `categories`, `tags`, and `publish_date` so that the backend plugin handles auto-generation/timestamps automatically.
*   **Task 98: Dialog Form Clean Up**
    *   **File:** [WordPressAdminPage.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/pages/WordPressAdminPage.tsx)
    *   **Action:** Removed input fields and labels for Slug, Categories, Tags, and Publish Date from the post dialog modal. Relabeled "Content (HTML supported)" simply to "Post Content".
*   **Task 99: public Blog tag pill fallback**
    *   **File:** [BlogSection.tsx](file:///c:/Users/dell/dyad-apps/Portal/src/components/BlogSection.tsx)
    *   **Action:** Added a fallback tag pill value of `"Update"` for posts without category assignments to preserve card styling.


