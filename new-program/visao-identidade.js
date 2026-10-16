import "./firebase-programas.js";
import { auth } from "../solda-login/firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const obterContexto = () => window.obterContextoVisaoFirebase();
export const listarProgramas = () => window.listarProgramasFirebase();
export const observarUsuario = callback => onAuthStateChanged(auth, user => callback(user?.uid || null));
