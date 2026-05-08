# POS App Backend Configuration Setup

## Quick Start

1. **Find your computer's IP address:**
   ```bash
   ipconfig
   ```
   Look for "IPv4 Address" (e.g., 192.168.1.100)

2. **Create `.env` file:**
   - Copy `.env.example` to `.env`
   - Update `API_URL` with your computer's IP address

3. **Start the backend:**
   ```bash
   cd C:\Users\dell\Desktop\SWIPS\samwega-inventory-backend
   npm start
   ```

4. **Update API URL in the app:**
   Edit `src/services/api.js` and replace the BASE_URL:
   ```javascript
   const BASE_URL = 'http://YOUR_IP_ADDRESS:3000/api/v1';
   ```

5. **Rebuild and run the app:**
   ```bash
   cd C:\Users\dell\Desktop\SWIPS\samwega-pos-bare
   npx react-native run-android
   ```

## How Registration Works

1. **Sales rep fills registration form:**
   - Username
   - Phone number (Kenyan format: 0712345678 or +254712345678)
   - Email
   - Password

2. **Account created in `users` collection with:**
   - `role`: 'sales_rep'
   - `isVerified`: false
   - `assignedVehicleId`: null

3. **Admin verifies the account:**
   - Go to admin system → Sales Representatives page
   - Find the new user
   - Click "Verify" button
   - Optionally assign a vehicle

4. **Sales rep can login after verification**

## Current Backend URL

The app is currently configured to use:
- **Android device:** Update `BASE_URL` in `src/services/api.js`
- **Backend should be:** Running on `http://YOUR_IP:3000`

Make sure your Android device and computer are on the same WiFi network!
