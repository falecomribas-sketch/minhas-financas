// ============================================================
//  CONFIGURAÇÃO DO FIREBASE
// ------------------------------------------------------------
//  COLE AQUI as credenciais do SEU projeto Firebase.
//  Veja o passo a passo no arquivo LEIA-ME.txt (Passo 3).
//
//  Você vai substituir os valores entre aspas abaixo pelos
//  valores que o Firebase te mostrar. NÃO apague as aspas.
// ============================================================

const firebaseConfig = {
  apiKey: "COLE_AQUI_SUA_API_KEY",
  authDomain: "COLE_AQUI_SEU_AUTH_DOMAIN",
  projectId: "COLE_AQUI_SEU_PROJECT_ID",
  storageBucket: "COLE_AQUI_SEU_STORAGE_BUCKET",
  messagingSenderId: "COLE_AQUI_SEU_MESSAGING_SENDER_ID",
  appId: "COLE_AQUI_SEU_APP_ID"
};

// Não precisa mexer daqui pra baixo.
window.__FIREBASE_CONFIG__ = firebaseConfig;
