import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB84uWdhZK08M6PNpL0PtB9sfa26EfmjCQ",
    authDomain: "quasar-erp-b26d5.firebaseapp.com",
    projectId: "quasar-erp-b26d5",
    storageBucket: "quasar-erp-b26d5.firebasestorage.app",
    messagingSenderId: "317018641428",
    appId: "1:317018641428:web:abcc068eec07827c140301"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
