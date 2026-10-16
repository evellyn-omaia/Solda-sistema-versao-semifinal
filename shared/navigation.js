(() => {
  const base = new URL('../', document.currentScript.src);
  const items = [
    ['Início', 'solda-system/index.html'], ['Operadores', 'solda-system/operadores.html'],
    ['Programas', 'carregar-programa/carregarprograma.html'], ['Modo Ensino', 'modo-ensino/modoensino.html'],
    ['Produção', 'iniciar-producao/iniciarproducao.html'], ['Configurações', 'configuracoes/index.html'],
    ['Alarmes', 'alarmes/index.html'], ['Histórico', 'painel-producao/painelproducao.html'],
  ];
  let nav = document.querySelector('#menuPrincipal .menu-links');
  if (!nav) {
    const details = document.createElement('details');
    details.className = 'soldatech-navigation';
    const summary = document.createElement('summary'); summary.textContent = '☰ SoldaTech';
    nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Menu principal');
    details.append(summary, nav); document.body.append(details);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { details.open = false; summary.focus(); } });
    document.addEventListener('click', e => { if (!details.contains(e.target)) details.open = false; });
  }
  nav.replaceChildren(...items.map(([title, path]) => {
    const a = document.createElement('a'); a.href = new URL(path, base).href; a.textContent = title;
    if (new URL(a.href).pathname === location.pathname) { a.classList.add('ativo'); a.setAttribute('aria-current', 'page'); }
    if (title === 'Operadores') { a.id = 'menuOperadores'; a.style.display = 'none'; }
    return a;
  }));
  // Navigation visibility follows the authenticated record; database rules remain authoritative.
  Promise.all([
    import(new URL('solda-login/firebase.js', base)),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js'),
  ]).then(([{ auth, db }, { onAuthStateChanged }, { ref, get }]) => {
    onAuthStateChanged(auth, async user => {
      const link = nav.querySelector('#menuOperadores'); link.style.display = 'none';
      if (!user) return;
      try { const record = await get(ref(db, `usuarios/${user.uid}`));
        if (auth.currentUser?.uid === user.uid && record.val()?.tipoUsuario === 'admin') link.style.display = '';
      } catch { /* Keep administrative navigation hidden when authorization cannot be checked. */ }
    });
  }).catch(() => {});
})();
