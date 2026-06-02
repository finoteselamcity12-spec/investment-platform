# 🚀 DEPLOYMENT & QUICK START GUIDE

## Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Make sure you have a `.env.local` file with:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Development Server
```bash
npm run dev
```
Runs on `http://localhost:5173`

### 4. Production Build
```bash
npm run build
```
Creates optimized `dist/` folder for deployment.

---

## Authentication Credentials

### Regular User
- **Email**: Any valid email (auto-creates account on first registration)
- **Password**: Min 8 characters, with uppercase, lowercase, and number

### Admin Panel
- **Admin Name**: `investment`
- **Admin ID**: `15610010`
- **Password**: `1q2w3e4r5t6y7@investment`

**Access**: Click the hidden admin trigger on the Support page (bottom-left corner)

---

## Key Features Overview

### For Users
✅ Register with email and password  
✅ Secure 30-minute sessions with inactivity timeout  
✅ Upload profile picture  
✅ Deposit funds (generates 5% bonus)  
✅ Claim bonus after admin approval  
✅ View transaction history  
✅ Withdraw funds (pending admin approval)  
✅ Access 24/7 support  

### For Admin
✅ Real-time platform statistics  
✅ Approve/reject deposits  
✅ Approve/reject withdrawals  
✅ View user wallets and balances  
✅ Manage user accounts  
✅ Track deposit breakdowns by payment method  
✅ Track withdrawal breakdowns by bank  

---

## Deposit Workflow

1. User clicks **Deposit** button
2. Fills in amount, payment method, transaction ID
3. Submits form (creates "Pending" request)
4. Admin reviews in Admin Dashboard
5. Admin clicks **Approve** → 5% bonus calculated
6. User sees bonus available in Home page
7. User clicks **Claim Bonus** → balance updated

---

## Withdrawal Workflow

1. User clicks **Withdraw** button
2. Selects bank/method and enters account details
3. **Balance is immediately deducted**
4. Request created with "Pending" status
5. Admin reviews in Admin Dashboard
6. Admin clicks **Approve Payout** or **Reject**
7. User is notified of status

---

## Session Management

### How It Works
- Sessions last **30 minutes** from last user activity
- Warning appears at **25 minutes** of inactivity
- 5-minute grace period to keep session active
- Any user interaction resets the timer

### Session Events
- User interactions tracked: clicks, scrolls, keypresses
- Activity automatically updates session expiration
- Warning notification: "Your session will expire in 5 minutes"
- On expiration: Auto-logout with "Session expired" message

---

## Form Validation Rules

### Login/Registration
- **Email**: Valid format (name@domain.ext)
- **Password**: Min 8 chars, uppercase, lowercase, number required
- **Full Name**: Min 2 characters
- **Confirm Password**: Must match password field

### Deposit
- **Amount**: 0 to 10,000,000
- **Currency**: USD or ETB
- **Payment Method**: Required
- **Transaction ID**: Min 3 characters

### Withdrawal
- **Amount**: Must not exceed available balance
- **Bank/Method**: Required selection
- **Account Name**: Min 3 characters
- **Account Number**: Min 3 characters (TRC20 address for USDT)

---

## Security Features

### Authentication
✅ JWT tokens with 30-minute expiration  
✅ Session storage (not localStorage)  
✅ Automatic logout on expiration  

### Data Protection
✅ Input sanitization (XSS prevention)  
✅ Email validation (RFC-compliant)  
✅ Password strength requirements  
✅ Hashed password storage (Supabase)  

### API Security
✅ All inputs validated server-side  
✅ Transaction IDs stored securely  
✅ User data encrypted in localStorage  

---

## Admin Dashboard Stats

| Metric | Description |
|--------|-------------|
| Total Users | Registered investors on platform |
| Total Deposits | Sum of all approved deposits (USD) |
| Total Withdrawals | Sum of all approved withdrawals (USD) |
| Active Investments | Currently active investment count |
| Pending Deposits | Awaiting admin review |
| Pending Withdrawals | In-progress withdrawal requests |
| Platform Health | System status (Excellent/Good) |
| Rejected Requests | Failed or cancelled transactions |

---

## Responsive Design

### Mobile (< 640px)
- Single column layout
- Bottom navigation bar
- Touch-optimized buttons
- Full-width cards

### Tablet (640px - 1024px)
- 2-column grid for cards
- Sidebar support
- Optimized spacing

### Desktop (> 1024px)
- 3-4 column grids
- Full feature visibility
- Enhanced information density

---

## Bonus System Formula

```
Bonus Calculation:
Bonus = Deposit Amount × 0.05

Example:
Deposit: $100
Bonus: $100 × 0.05 = $5
Final Balance: $105
```

### Bonus Eligibility
- Calculated when admin approves deposit
- Stored in user profile
- User sees "Claim Bonus" button
- One-click claim adds to balance

---

## Color Scheme

- **Primary**: Lime Green (#84CC16)
- **Success**: Green gradients
- **Error**: Red gradients
- **Warning**: Amber gradients
- **Info**: Blue gradients
- **Background**: White with subtle gradients

---

## Browser Compatibility

✅ Chrome 90+  
✅ Firefox 88+  
✅ Safari 14+  
✅ Edge 90+  
✅ Mobile Browsers (iOS Safari, Chrome Mobile)  

---

## Troubleshooting

### Session Expired Unexpectedly
- Check for 30-minute inactivity period
- Perform any action (click, scroll, type) to reset timer
- Look for warning at 25-minute mark

### Deposit/Withdrawal Pending
- Admin needs to review in Admin Dashboard
- Check transaction history for status
- Deposits eligible for bonus after approval

### Profile Picture Not Saving
- Check file size (max 5MB)
- Verify image format (JPG, PNG, WebP, GIF)
- Allow browser access to localStorage

### Balance Not Updating
- Refresh the page
- Check pending deposits/withdrawals
- Verify admin hasn't rejected request

---

## Support & Contact

**Support Channel**: In-app Support page → Telegram  
**Telegram**: @investment_platform_3  
**Email**: finoteselamcity12@gmail.com  

---

## Version Info

- **Platform**: Investment Platform v2.0.0 (Enterprise Edition)
- **Build Status**: ✅ Production Ready
- **Last Updated**: June 1, 2026
- **Technology**: React 19.2 + Vite 8.0 + Tailwind CSS 4.3

---

## Next Steps for Deployment

1. ✅ Build successful: `npm run build`
2. ✅ All tests passing
3. ✅ Ready for Vercel deployment
4. Run: `vercel --prod` (if Vercel CLI installed)
5. Or push to GitHub and enable Vercel auto-deploy

---

**Ready for production deployment! 🚀**
