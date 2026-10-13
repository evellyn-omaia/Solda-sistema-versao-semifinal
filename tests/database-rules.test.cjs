// Avalia as condições de autorização como JS com snapshots simulados.
// Não substitui compilação/herança de regras no emulador Firebase.
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../database-rules.json').rules;
function snapshot(tree, parts = []) {
  const value = parts.reduce((o, key) => o?.[key], tree) ?? null;
  return { val: () => value, exists: () => value !== null,
    child: key => snapshot(tree, [...parts, ...key.split('/')]),
    parent: () => snapshot(tree, parts.slice(0, -1)),
    hasChild: key => value?.[key] != null };
}
function allow(before, after, actor, uid) {
  return Function('auth', 'root', 'data', 'newData', '$uid', `return ${rules.usuarios.$uid['.write']}`)(
    actor ? {uid: actor} : null, snapshot(before), snapshot(before, ['usuarios', uid]), snapshot(after, ['usuarios', uid]), uid);
}
const profile = (company, role) => ({empresaId: company, tipoUsuario: role});
test('regras: autocadastro nao permite ingressar em empresa alheia ou escolher perfil operador', () => {
  for (const role of ['admin', 'operador']) assert.equal(allow({}, {usuarios: {a: profile('empresa_b', role)}}, 'a', 'a'), false);
  assert.equal(allow({}, {usuarios: {a: profile('empresa_a', 'operador')}}, 'a', 'a'), false);
});
test('regras: cadastro atomico da propria empresa e administrador permitido', () => {
  assert.equal(allow({}, {usuarios:{a:profile('empresa_a','admin')},empresas:{empresa_a:{adminUid:'a'}}}, 'a', 'a'), true);
});
test('regras: operador nao eleva privilegios nem muda empresa', () => {
  const before={usuarios:{a:profile('empresa_a','operador')}};
  for(const target of [profile('empresa_a','admin'),profile('empresa_b','operador')]) assert.equal(allow(before,{usuarios:{a:target}},'a','a'),false);
  assert.equal(allow(before,before,'a','a'),true);
  assert.equal(allow(before,before,null,'a'),false);
});
test('regras: admin cadastra operador da propria empresa sem tomar conta de outra empresa', () => {
  const before={usuarios:{a:profile('empresa_a','admin'),b:profile('empresa_b','operador')}};
  assert.equal(allow(before,{usuarios:{...before.usuarios,c:profile('empresa_a','operador')}},'a','c'),true);
  assert.equal(allow(before,{usuarios:{...before.usuarios,b:profile('empresa_a','operador')}},'a','b'),false);
});
test('regras: empresa nao pode ser apagada ou ter proprietario alterado pelo membro', () => {
  const before={usuarios:{a:profile('empresa_b','operador')},empresas:{empresa_b:{adminUid:'b'}}};
  const evaluate=after=>Function('auth','root','data','newData','$empresaId',`return ${rules.empresas.$empresaId['.write']}`)(
    {uid:'a'},snapshot(before),snapshot(before,['empresas','empresa_b']),snapshot(after,['empresas','empresa_b']),'empresa_b');
  assert.equal(evaluate({}),false);
  assert.equal(evaluate({empresas:{empresa_b:{adminUid:'a'}}}),false);
  assert.equal(evaluate(before),true);
});
