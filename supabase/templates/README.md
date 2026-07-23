# Roventra authentication email templates

These files are the source of truth for the hosted Supabase authentication
email templates.

## Installation

In Supabase, open **Authentication > Email Templates**. Open each template,
copy the matching HTML file into the message body, set the subject shown below,
and save it.

| Supabase template | Subject | Source file |
| --- | --- | --- |
| Confirm signup | Confirm your Roventra account | `confirmation.html` |
| Invite user | You have been invited to Roventra | `invite.html` |
| Magic link or OTP | Your secure Roventra sign-in link | `magic-link.html` |
| Change email address | Confirm your new Roventra email address | `email-change.html` |
| Reset password | Reset your Roventra password | `recovery.html` |
| Reauthentication | `{{ .Token }}` is your Roventra verification code | `reauthentication.html` |

## Requirements

- Keep the Supabase template variables unchanged.
- Link-based templates use Roventra's `/auth/callback` endpoint and
  `{{ .TokenHash }}` so recipients do not see the Supabase project hostname.
- Set the hosted Supabase Site URL to the canonical Roventra application URL.
- Keep Resend click and open tracking disabled for authentication messages.
- The logo must remain publicly available at the HTTPS URL used in the files.
- Send a real test for every authentication flow after changing a template.
- Review templates in desktop, mobile, light-mode, and dark-mode email clients.
