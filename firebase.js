// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, setDoc, getDoc,
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, updateDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD4R2FQRpIoig7tlbT-ux5DEGGUh9eo_Eg",
  authDomain: "indkoeb-8810d.firebaseapp.com",
  projectId: "indkoeb-8810d",
  storageBucket: "indkoeb-8810d.firebasestorage.app",
  messagingSenderId: "689356942821",
  appId: "1:689356942821:web:2ce4c2874198a68b04930c",
  measurementId: "G-TGW6HWHC1L"
};

const app = initializeApp(firebaseConfig);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export {
  db,
  doc, setDoc, getDoc,
  collection, addDoc, onSnapshot, query, orderBy,
  serverTimestamp, updateDoc, deleteDoc
};
