// TODO: Ganti dengan konfigurasi dari Firebase Project Anda
// Dapatkan config ini dari Firebase Console -> Project Settings -> General -> Web App

const firebaseConfig = {
  apiKey: "AIzaSyA7dGCYcddkCfwx60jPC-VkPLmFIlvdOPA",
  authDomain: "testes-72587.firebaseapp.com",
  projectId: "testes-72587",
  storageBucket: "testes-72587.firebasestorage.app",
  messagingSenderId: "212544768508",
  appId: "1:212544768508:web:13dbf35543ac2372290a79",
  measurementId: "G-S153LPZPS5"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
