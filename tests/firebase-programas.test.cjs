const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function ambiente({ sessao, cadastro = { empresaId: "empresa-a" }, empresa = {}, logado = true, negar = false, trocar = false } = {}) {
  const storage = new Map(sessao ? [["empresaId", sessao]] : []);
  const leituras = [];
  const escritas = [];
  const usuario = { uid: "usuario-a", email: "operador@example.test" };
  const auth = { currentUser: logado ? usuario : null };
  const source = fs.readFileSync(path.join(__dirname, "../new-program/firebase-programas.js"), "utf8")
    .replace(/^import\s+[\s\S]*?\s+from\s+"[^"]+";\s*/gm, "");
  const context = vm.createContext({
    window: {}, auth, db: {},
    sessionStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    onAuthStateChanged: (_, callback) => {
      queueMicrotask(() => callback(auth.currentUser));
      return () => {};
    },
    ref: (_, caminho) => caminho,
    get: async (caminho) => {
      leituras.push(caminho);
      if (negar) throw new Error("PERMISSION_DENIED");
      const valor = caminho === "usuarios/usuario-a" ? cadastro
        : caminho === "empresas/empresa-a" ? empresa : null;
      if (trocar) auth.currentUser = { uid: "outro-usuario" };
      return { exists: () => valor != null, val: () => valor };
    },
    set: async (caminho, dados) => escritas.push({ caminho, dados }),
    onValue: (caminho) => { leituras.push(caminho); return () => {}; },
  });
  vm.runInContext(source, context);
  return { api: context.window, storage, leituras, escritas };
}

test("salvamento recupera a empresa quando a sessão está vazia", async () => {
  const a = ambiente();
  await a.api.salvarProgramaFirebase("Teste", { pontos: [] });
  assert.equal(a.storage.get("empresaId"), "empresa-a");
  assert.equal(a.escritas[0].caminho, "empresas/empresa-a/programas/Teste");
  assert.equal(a.escritas[0].dados.empresaId, "empresa-a");
});

test("sessão de outra empresa é substituída pelo vínculo autenticado", async () => {
  const a = ambiente({ sessao: "empresa-b" });
  await a.api.salvarProgramaFirebase("Teste", {});
  assert.equal(a.storage.get("empresaId"), "empresa-a");
  assert.ok(a.leituras.every((caminho) => !caminho.includes("empresa-b")));
  assert.equal(a.escritas[0].caminho, "empresas/empresa-a/programas/Teste");
});

test("consulta, observação e salvamento da produção recuperam a sessão", async () => {
  for (const nome of ["buscarProducaoAtualFirebase", "observarProducaoAtualFirebase", "salvarProducaoAtualFirebase"]) {
    const a = ambiente();
    await a.api[nome](nome === "salvarProducaoAtualFirebase" ? {} : () => {});
    assert.equal(a.storage.get("empresaId"), "empresa-a");
    assert.ok([...a.leituras, ...a.escritas.map((item) => item.caminho)]
      .includes("empresas/empresa-a/producaoAtual/usuario-a"));
  }
});

test("cadastro inválido, empresa inexistente e falhas de autenticação bloqueiam gravação", async () => {
  for (const opcoes of [
    { cadastro: null }, { cadastro: {} }, { cadastro: { empresaId: " " } },
    { cadastro: { empresaId: "outra/empresa" } }, { empresa: null },
    { logado: false }, { negar: true }, { trocar: true },
  ]) {
    const a = ambiente(opcoes);
    await assert.rejects(async () => a.api.salvarProgramaFirebase("Teste", {}));
    assert.equal(a.escritas.length, 0);
    assert.equal(a.storage.has("empresaId"), false);
  }
});
