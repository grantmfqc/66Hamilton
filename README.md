# The Hamilton Residence — Prospectus Website
## Setup Instructions

### 1. Add Your Photos
Create an `assets/` folder inside `/home/grant/66HamiltonRd/` and save your images with these exact filenames:

| File | Source |
|---|---|
| `assets/hero-platter.jpg` | The platter/grazing board photo (used as hero background) |
| `assets/sunset-living.jpg` | The sunset living room / golden hour photo |
| `assets/harbour-bridge.jpg` | The harbour bridge / waterfront walkway photo |

**To do this:**
1. Open your file manager and navigate to `/home/grant/66HamiltonRd/`
2. Create a new folder called `assets`
3. Copy your 3 photos in and rename them exactly as above

### 2. Open the Website Locally
Open `/home/grant/66HamiltonRd/index.html` in your browser to preview.

### 3. Sections in the Site
The page includes:
- **Hero** — Full-screen platter photo with cinematic dark overlay
- **Stats Strip** — 3 Bed · 188m² · Top Floor · Waterfront · 90+ Days
- **The Residence** — Sunset living room photo + editorial copy
- **The View** — Full-bleed harbour bridge photo with quote
- **Gallery** — 6-grid mosaic (3 real photos + 3 placeholders for bedroom/bathroom)
- **Amenities** — 8 icon cards (fibre, parking, security, etc.)
- **Location** — Distance table + embedded Google Map
- **Lease Terms** — Corporate terms table
- **Prospectus Form** — OTP-verified lead capture
- **Footer**

### 4. The OTP Flow (Current State)
The OTP verification currently generates a code in the browser console (for testing). To make it actually send emails, you'll need to connect it to a backend API (see next steps below).

### 5. Next Steps — Going Live
1. Choose a domain (`thehamiltonresidence.co.nz` recommended)
2. Deploy to Vercel (free) — connect your GitHub repo
3. Add a Resend.com API key to send real OTP emails and deliver the PDF
