import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyB84uWdhZK08M6PNpL0PtB9sfa26EfmjCQ",
    authDomain: "quasar-erp-b26d5.firebaseapp.com",
    projectId: "quasar-erp-b26d5",
    storageBucket: "quasar-erp-b26d5.firebasestorage.app",
    messagingSenderId: "317018641428",
    appId: "1:317018641428:web:abcc068eec07827c140301"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { app, db };
