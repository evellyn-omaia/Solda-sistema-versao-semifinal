import {
  authOperadores,
  db
} from "../solda-login/firebase.js";
import {
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  ref,
  set,
  get,
  query,
  orderByChild,
  equalTo
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// =====================================
// PROTEGER PÁGINA DE OPERADORES
// =====================================

const tipoUsuarioLogado =
  sessionStorage.getItem("tipoUsuario");

const empresaIdLogada =
  sessionStorage.getItem("empresaId");

if (
  tipoUsuarioLogado !== "admin" ||
  !empresaIdLogada
) {

  alert(
    "Acesso permitido apenas para administradores."
  );

  window.location.href =
    "./index.html";

  throw new Error(
    "Acesso não autorizado."
  );
}
const formOperador =
  document.getElementById("formOperador");

const nomeOperador =
  document.getElementById("nomeOperador");

const emailOperador =
  document.getElementById("emailOperador");

const senhaOperador =
  document.getElementById("senhaOperador");


formOperador.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    try {

      const empresaId =
        sessionStorage.getItem("empresaId");

      const tipoUsuario =
        sessionStorage.getItem("tipoUsuario");


      if (tipoUsuario !== "admin") {

        alert(
          "Apenas administradores podem cadastrar operadores."
        );

        return;
      }


      if (!empresaId) {

        alert(
          "Empresa não identificada."
        );

        return;
      }


    const credencial =
  await createUserWithEmailAndPassword(
    authOperadores,
    emailOperador.value.trim(),
    senhaOperador.value
  );


      const operadorUid =
        credencial.user.uid;


      const dadosOperador = {

        nome:
          nomeOperador.value.trim(),

        email:
          emailOperador.value.trim(),

        empresaId:
          empresaId,

        tipoUsuario:
          "operador",

        criadoEm:
          Date.now()

      };


      await set(
        ref(
          db,
          `usuarios/${operadorUid}`
        ),
        dadosOperador
      );
await signOut(
  authOperadores
);

      alert(
        "Operador cadastrado com sucesso!"
      );


      formOperador.reset();

      await carregarOperadores();


    } catch (error) {

      console.error(
        "Erro ao cadastrar operador:",
        error
      );

      alert(
        error.message
      );

    }

  }
);

// =====================================
// LISTAR OPERADORES DA EMPRESA
// =====================================

async function carregarOperadores() {

  const listaOperadores =
    document.getElementById("listaOperadores");

  try {

  const consultaOperadores =
  query(
    ref(db, "usuarios"),
    orderByChild("empresaId"),
    equalTo(empresaIdLogada)
  );

const snapshot =
  await get(
    consultaOperadores
  );

    listaOperadores.innerHTML = "";


    if (!snapshot.exists()) {

      listaOperadores.innerHTML =
        "Nenhum operador cadastrado.";

      return;
    }


    let encontrouOperador = false;


    snapshot.forEach((usuarioSnapshot) => {

      const usuario =
        usuarioSnapshot.val();


      if (
        usuario.tipoUsuario === "operador" &&
        usuario.empresaId === empresaIdLogada
      ) {

        encontrouOperador = true;


        const operador =
          document.createElement("div");


        const descricao = document.createElement("p");
        const nomeOperador = document.createElement("strong");
        nomeOperador.textContent = usuario.nome || "";
        descricao.append(
          nomeOperador,
          document.createElement("br"),
          document.createTextNode(usuario.email || ""),
        );
        operador.appendChild(descricao);


        listaOperadores.appendChild(
          operador
        );

      }

    });


    if (!encontrouOperador) {

      listaOperadores.innerHTML =
        "Nenhum operador cadastrado.";

    }


  } catch (error) {

    console.error(
      "Erro ao carregar operadores:",
      error
    );

    listaOperadores.innerHTML =
      "Erro ao carregar operadores.";

  }

}


carregarOperadores();
