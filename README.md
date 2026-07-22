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

Customer URL: `https://USERNAME.github.io/REPOSITORY/?table=1`

Tables 1–25 ke liye URL me table number badlein. Owner panel: `owner.html`

Important: Firebase web config secret password nahi hota. Security Firestore Rules aur Firebase Authentication se hoti hai.

## Menu editing

- Starter menu me 72 food aur drink items hain.
- Owner panel me **Menu** kholkar price, availability aur image URL edit kar sakte hain.
- Google Images me full photo kholkar **Copy image address** karein, phir Image URL field me paste karein.
- Existing Firestore prices overwrite nahi hote. Owner login par sirf missing starter items aur missing images add hote hain.

HTML, CSS aur JavaScript files normal indentation ke saath formatted hain, isliye code dhoondhna aur edit karna easy hai.
