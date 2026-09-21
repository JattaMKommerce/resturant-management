import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAcYCEhvb3iRsXzXPWxrZ1ySZJn0Zv3EgE",
  authDomain: "hotel-management-5ac7c.firebaseapp.com",
  projectId: "hotel-management-5ac7c",
  storageBucket: "hotel-management-5ac7c.firebasestorage.app",
  messagingSenderId: "175603410627",
  appId: "1:175603410627:web:53518b083c8a8507486476",
  measurementId: "G-8C1L6V0ZC9"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
auth.useDeviceLanguage();

export { app, auth };
export default app;
