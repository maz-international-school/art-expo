// firebase-config.js

const firebaseConfig = {
  apiKey: "AIzaSyCy1u5n7YgFtom8swiVIOvr3jpY_MQPXxs",
  authDomain: "art-expo-maz.firebaseapp.com",
  projectId: "art-expo-maz",
  storageBucket: "art-expo-maz.firebasestorage.app",
  messagingSenderId: "978514613145",
  appId: "1:978514613145:web:466cbe411e30dfe4d63908",
  measurementId: "G-07ZMN0CEG8"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore (the database)
const db = firebase.firestore();