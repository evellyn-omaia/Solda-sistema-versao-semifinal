"""Testa configuração e publicação sem importar câmera nem conectar MQTT."""
import ast
import importlib.util
import json
import os
from pathlib import Path
import types
import unittest
import threading
import time
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "visao-python" / "visao.py"
TREE = ast.parse(SOURCE.read_text(encoding="utf-8"))
spec = importlib.util.spec_from_file_location("controle_gestos", SOURCE.with_name("controle_gestos.py"))
modulo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(modulo)
ControleGestos = modulo.ControleGestos


class VisaoTest(unittest.TestCase):
    def test_configuracao_local_e_tls_por_ambiente(self):
        names = {"MQTT_HOST", "MQTT_PORT", "MQTT_TLS", "MQTT_USER", "MQTT_PASS"}
        nodes = [n for n in TREE.body if isinstance(n, ast.Assign)
                 and any(isinstance(t, ast.Name) and t.id in names for t in n.targets)]
        code = compile(ast.Module(body=nodes, type_ignores=[]), str(SOURCE), "exec")
        for env, host, port, tls in [({}, "localhost", 1883, False),
                                    ({"MQTT_HOST": "example.test", "MQTT_PORT": "8883"}, "example.test", 8883, True)]:
            with patch.dict(os.environ, env, clear=True):
                scope = {"os": os}
                exec(code, scope)
                self.assertEqual((scope["MQTT_HOST"], scope["MQTT_PORT"], scope["MQTT_TLS"]), (host, port, tls))
        with patch.dict(os.environ, {"MQTT_PASSWORD": "valor-ficticio-de-teste"}, clear=True):
            scope = {"os": os}
            exec(code, scope)
            self.assertEqual(scope["MQTT_PASS"], "valor-ficticio-de-teste")

    def test_payload_e_confirmacao_de_publicacao(self):
        function = next(n for n in TREE.body if isinstance(n, ast.FunctionDef) and n.name == "enviar_gesto")
        code = compile(ast.Module(body=[function], type_ignores=[]), str(SOURCE), "exec")
        for confirmed in (True, False):
            sent = []
            result = types.SimpleNamespace(rc=0, wait_for_publish=lambda **_: None,
                                           is_published=lambda: confirmed)
            def publish(topic, message, qos):
                sent.append((topic, json.loads(message), qos))
                return result
            scope = dict(mqtt_conectado=types.SimpleNamespace(is_set=lambda: True),
                         ultimo_envio=0, COOLDOWN=2, time=types.SimpleNamespace(monotonic=lambda: 100),
                         json=json, MQTT_TOPIC="soldatech/visao/gesto",
                         mqtt_client=types.SimpleNamespace(publish=publish),
                         mqtt=types.SimpleNamespace(MQTT_ERR_SUCCESS=0), print=lambda *args: None)
            exec(code, scope)
            self.assertEqual(scope["enviar_gesto"]("START"), confirmed)
            self.assertEqual(sent, [("soldatech/visao/gesto", {"tipo": "GESTO_VISAO", "gesto": "START"}, 1)])
            self.assertEqual(scope["ultimo_envio"], 100 if confirmed else 0)

    def test_cooldown_nao_consume_gesto_mantido(self):
        agora = [0.0]
        publicados = []
        def publicar(gesto):
            if agora[0] < 2:
                return None
            publicados.append(gesto)
            return True
        controle = ControleGestos(publicar, relogio=lambda: agora[0])
        for instante in [0, 0.25, 1, 2, 3, 4]:
            agora[0] = instante
            controle.atualizar("PALMA", True)
        self.assertEqual(publicados, ["START"])

    def test_oscilacao_curta_nao_publica_e_gesto_estavel_nao_repete(self):
        agora = [0.0]
        publicados = []
        controle = ControleGestos(lambda g: publicados.append(g) or True, relogio=lambda: agora[0])
        for instante, gesto in [(0, "PALMA"), (0.1, "PUNHO"), (0.2, "PALMA"),
                                (0.3, "NEUTRO"), (1, "PUNHO"), (1.3, "PUNHO"), (2, "PUNHO")]:
            agora[0] = instante
            controle.atualizar(gesto, True)
        self.assertEqual(publicados, ["PAUSA"])

    def test_reconexao_exige_neutro_e_novo_gesto(self):
        for detectou_offline in (True, False):
            agora = [0.0]
            publicados = []
            controle = ControleGestos(lambda g: publicados.append(g) or True, relogio=lambda: agora[0])
            controle.atualizar("PALMA", True, 1)
            if detectou_offline:
                controle.atualizar("PALMA", False, 2)
            for instante, gesto in [(1, "PALMA"), (2, "PALMA"), (3, "NEUTRO"),
                                    (3.3, "NEUTRO"), (4, "PALMA"), (4.3, "PALMA"), (5, "PALMA")]:
                agora[0] = instante
                controle.atualizar(gesto, True, 3)
                if instante < 4.3:
                    self.assertEqual(publicados, [])
            self.assertEqual(publicados, ["START"])

    def test_falha_ambigua_nao_republica_gesto_automaticamente(self):
        agora = [0.0]
        tentativas = []
        controle = ControleGestos(lambda g: tentativas.append(g) or False, relogio=lambda: agora[0])
        for instante in [0, 1, 2, 3, 10]:
            agora[0] = instante
            controle.atualizar("PALMA", True)
        self.assertEqual(tentativas, ["START"])

    def test_gesto_antigo_adiado_nao_substitui_gesto_atual(self):
        agora = [0.0]
        publicados = []
        def publicar(gesto):
            if agora[0] < 2:
                return None
            publicados.append(gesto)
            return True
        controle = ControleGestos(publicar, relogio=lambda: agora[0])
        for instante, gesto in [(0, "PALMA"), (0.3, "PALMA"), (1, "PUNHO"), (2, "PUNHO")]:
            agora[0] = instante
            controle.atualizar(gesto, True)
        self.assertEqual(publicados, ["PAUSA"])

    def test_liberacao_camera_e_mqtt_mesmo_se_recurso_falhar(self):
        function = next(n for n in TREE.body if isinstance(n, ast.FunctionDef) and n.name == "encerrar_recursos")
        chamadas = []
        def falhar():
            chamadas.append("camera")
            raise RuntimeError("Falha simulada")
        scope = dict(recursos_encerrados=False, cap=types.SimpleNamespace(release=falhar),
                     cv2=types.SimpleNamespace(destroyAllWindows=lambda: chamadas.append("janelas")),
                     hands=types.SimpleNamespace(close=lambda: chamadas.append("hands")),
                     mqtt_client=types.SimpleNamespace(disconnect=lambda: chamadas.append("mqtt"),
                                                       loop_stop=lambda: chamadas.append("loop")),
                     print=lambda *args: None)
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(SOURCE), "exec"), scope)
        scope["encerrar_recursos"]()
        scope["encerrar_recursos"]()
        self.assertEqual(chamadas, ["camera", "janelas", "hands", "mqtt", "loop"])

    def test_classificacao_existente_palma_punho_neutro(self):
        function = next(n for n in TREE.body if isinstance(n, ast.FunctionDef) and n.name == "classificar_gesto")
        scope = {}
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(SOURCE), "exec"), scope)
        for quantidade, esperado in [(4, "PALMA"), (0, "PUNHO"), (2, "NEUTRO")]:
            pontos = [types.SimpleNamespace(y=1.0) for _ in range(21)]
            for indice in [8, 12, 16, 20][:quantidade]:
                pontos[indice].y = 0.0
            self.assertEqual(scope["classificar_gesto"](types.SimpleNamespace(landmark=pontos)), esperado)

    def test_script_sem_camera_ou_com_perda_de_frame_libera_recursos(self):
        # Executa o corpo real do script, substituindo todos os imports de IO.
        code = compile(ast.Module(body=[n for n in TREE.body
                                       if not isinstance(n, (ast.Import, ast.ImportFrom))],
                                  type_ignores=[]), str(SOURCE), "exec")
        for aberta in (False, True):
            chamadas, ao_sair = [], []
            client = types.SimpleNamespace(
                reconnect_delay_set=lambda **kwargs: None,
                loop_start=lambda: None, loop_stop=lambda: chamadas.append("loop"),
                disconnect=lambda: chamadas.append("mqtt"),
                publish=lambda *args, **kwargs: self.fail("Não deve publicar sem imagem"))
            client.connect = lambda *args, **kwargs: client.on_connect(client, None, None, 0, None)
            cap = types.SimpleNamespace(isOpened=lambda: aberta, read=lambda: (False, None),
                                        release=lambda: chamadas.append("camera"))
            scope = dict(
                cv2=types.SimpleNamespace(VideoCapture=lambda _: cap,
                                          destroyAllWindows=lambda: chamadas.append("janelas")),
                mp=types.SimpleNamespace(solutions=types.SimpleNamespace(
                    hands=types.SimpleNamespace(Hands=lambda **_: types.SimpleNamespace(close=lambda: chamadas.append("hands"))),
                    drawing_utils=None)),
                mqtt=types.SimpleNamespace(Client=lambda *args, **kwargs: client,
                                           CallbackAPIVersion=types.SimpleNamespace(VERSION2=2)),
                os=os, json=json, time=time, threading=threading,
                atexit=types.SimpleNamespace(register=ao_sair.append),
                ControleGestos=ControleGestos, print=lambda *args: None)
            with patch.dict(os.environ, {}, clear=True):
                try:
                    if aberta:
                        exec(code, scope)
                    else:
                        with self.assertRaisesRegex(RuntimeError, "abrir a câmera"):
                            exec(code, scope)
                finally:
                    for fn in ao_sair:
                        fn()
            self.assertEqual(chamadas.count("camera"), 1)
            self.assertEqual(chamadas.count("hands"), 1)
            self.assertIn("mqtt", chamadas)


if __name__ == "__main__":
    unittest.main()
