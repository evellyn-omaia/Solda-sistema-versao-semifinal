"""Controle de entrega de gestos; não conhece produção, MQTT ou CLP."""
import time


class ControleGestos:
    def __init__(self, publicar, relogio=time.monotonic, estabilidade=0.2):
        self.publicar = publicar
        self.relogio = relogio
        self.estabilidade = estabilidade
        self.candidato = None
        self.desde = 0
        self.enviado = None
        self.geracao = None
        self.aguardando_neutro = False

    def atualizar(self, gesto, conectado, geracao=0):
        agora = self.relogio()
        if self.geracao is not None and geracao != self.geracao:
            self.aguardando_neutro = True
            self.candidato = None
        self.geracao = geracao

        if not conectado:
            self.aguardando_neutro = True
            self.candidato = None
            return False

        if gesto not in ("PALMA", "PUNHO", "NEUTRO"):
            gesto = "NEUTRO"
        if gesto != self.candidato:
            self.candidato = gesto
            self.desde = agora
            return False
        if agora - self.desde < self.estabilidade:
            return False

        if gesto == "NEUTRO":
            self.enviado = None
            self.aguardando_neutro = False
            return False
        if self.aguardando_neutro or gesto == self.enviado:
            return False

        resultado = self.publicar("START" if gesto == "PALMA" else "PAUSA")
        if resultado is True:
            self.enviado = gesto
            return True
        if resultado is False:
            # Falha de transporte pode ter resultado ambíguo: não repetir
            # automaticamente; exigir neutro e um novo gesto.
            self.aguardando_neutro = True
        # None indica somente cooldown: o gesto atual continua elegível.
        return False
