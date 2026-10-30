# Campus Club Ops — Admin & Operations Portal

The operational admin dashboard for university event coordinators, society chairs, and campus administrators.

## Features

- **Role Switcher**: Live previews for `Super Admin`, `Chairperson`, `Core Member`, and `Executive`.
- **System Overview**: High-level metrics for active clubs, events, conflicts, and proposals.
- **Clubs & Societies Directory**: Manage student societies, categories, chairperson designations, and member counts.
- **Users & Permissions**: Manage user accounts and multi-tier club role privileges.
- **Events & Proposal Pipeline**: Proposal lifecycle from draft to approved status with conflict detection.
- **Conflict Center**: Venue double-booking resolution and coordination matrix.
- **Reports & Analytics**: Comprehensive participation views and audit trail summaries.

## Running the Admin Portal

```bash
cd admin
node server.cjs
```

The portal runs on **http://localhost:5174** (or `http://127.0.0.1:5174`).
