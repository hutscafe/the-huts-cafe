# The Huts Cafe — GitHub Pages + Firebase

## Free setup

1. Firebase Console me free project banayein (Spark plan).
2. Authentication > Sign-in method me Email/Password enable karein.
3. Authentication > Users me owner ka email/password banayein.
4. Firestore Database create karein.
5. Firestore Rules me `firestore.rules` ka content paste karke Publish karein.
6. Project Settings > Your apps > Web app create karein.
7. Firebase config ko `js/firebase-config.js` me paste karein.
8. Is folder ke sab files GitHub repository ke root me upload karein.
9. GitHub Settings > Pages > Deploy from branch > main/root select karein.
10. Updated `firestore.rules` ko Firebase Firestore Rules tab me paste karke Publish karein.

Customer URL: `https://USERNAME.github.io/REPOSITORY/?table=1`

Tables 1–10 ke liye URL me table number badlein. Restricted Order Operations App: `owner.html`

Important: Firebase web config secret password nahi hota. Security Firestore Rules aur Firebase Authentication se hoti hai.

## Managed menu and restricted access

- Starter menu me 72 food aur drink items hain.
- Cafe account ko menu, price, image, QR, Firebase, GitHub ya source-code editing access nahi milta.
- `owner.html` me sirf Orders, 10 Tables, Billing/KOT aur read-only Reports milte hain.
- Menu updates Vasuki NFC ke managed server workflow se kiye jayenge.
- Customer menu par permanent Vasuki NFC branding/contact link hai.

## Included QR files

`qr/` folder me Table 01 se Table 10 tak 10 ready PNG QR codes hain. Ye QR codes current live URL `https://hutscafe.github.io/the-huts-cafe/` ke liye generated hain.

## Important deployment order

1. GitHub me complete updated project upload/replace karein.
2. Firebase me updated `firestore.rules` publish karein.
3. Owner app ko logout/login karke hard refresh karein.
4. Table 1 aur Table 10 QR scan karke test order place karein.
5. Owner app me Orders, Tables, Billing/KOT aur Reports verify karein.

HTML, CSS aur JavaScript files normal indentation ke saath formatted hain, isliye code dhoondhna aur edit karna easy hai.

## Demo images ko real images se replace karein

- Customer menu ki hero photo: `assets/cafe-hero.png`
- KOT aur bill ka cafe logo: `assets/cafe-logo.png`
- Bill ka bank/UPI payment QR: `assets/payment-qr.png`
- Nayi files ka naam aur extension bilkul same rakhein, tab code edit nahi karna padega.
- `payment-qr.png` abhi sirf demo placeholder hai. Live use se pehle cafe ka asli bank/UPI QR lagana mandatory hai.
