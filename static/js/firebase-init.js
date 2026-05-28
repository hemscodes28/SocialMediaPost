import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCuEgLqq1k8xBGHCKasFaYwPbcd44O7FGo",
  authDomain: "smauto-10c96.firebaseapp.com",
  projectId: "smauto-10c96",
  storageBucket: "smauto-10c96.firebasestorage.app",
  messagingSenderId: "560589221785",
  appId: "1:560589221785:web:6a136a9e94de691026ad08",
  measurementId: "G-GPP3J5VM83",
};

export const firebaseApp = initializeApp(firebaseConfig);
getAnalytics(firebaseApp);
export const auth = getAuth(firebaseApp);
