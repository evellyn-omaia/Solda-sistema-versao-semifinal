import cv2
import mediapipe as mp
import paho.mqtt.client as mqtt
import os
import json
import time
import threading


# ==========================================
# CONFIGURAÇÃO
# ==========================================

CAMERA_INDEX = 0

# Tópico que receberá os gestos
MQTT_TOPIC = "soldatech/visao/gesto"

# ==========================================
# CONFIGURAÇÃO DO HIVEMQ
# ==========================================

MQTT_HOST = os.getenv(
    "MQTT_HOST",
    "0c8e76fe2d694a2e963905f30e8ab299.s1.eu.hivemq.cloud"
)

MQTT_PORT = int(
    os.getenv("MQTT_PORT", "8883")
)

MQTT_USER = os.getenv("MQTT_USER")

MQTT_PASSWORD = os.getenv("MQTT_PASSWORD")


# ==========================================
# VALIDAR CREDENCIAIS
# ==========================================

if not MQTT_USER:
    raise RuntimeError(
        "MQTT_USER não foi definido no PowerShell."
    )

if not MQTT_PASSWORD:
    raise RuntimeError(
        "MQTT_PASSWORD não foi definido no PowerShell."
    )


# ==========================================
# CONTROLE DA CONEXÃO MQTT
# ==========================================

mqtt_conectado = threading.Event()


# ==========================================
# CRIAR CLIENTE MQTT
# ==========================================

mqtt_client = mqtt.Client(
    mqtt.CallbackAPIVersion.VERSION2,
    client_id="SoldaTouch-Visao"
)


# ==========================================
# USUÁRIO E SENHA
# ==========================================

mqtt_client.username_pw_set(
    MQTT_USER,
    MQTT_PASSWORD
)


# ==========================================
# TLS
# ==========================================

mqtt_client.tls_set()


# ==========================================
# CALLBACK DE CONEXÃO
# ==========================================

def ao_conectar(
    client,
    userdata,
    flags,
    reason_code,
    properties
):

    print(
        f"[MQTT] Resultado da conexão: {reason_code}"
    )

    if reason_code == 0:

        print("[MQTT] CONECTADO AO HIVEMQ!")

        mqtt_conectado.set()

    else:

        print(
            f"[MQTT] CONEXÃO RECUSADA: {reason_code}"
        )

        mqtt_conectado.clear()


mqtt_client.on_connect = ao_conectar


# ==========================================
# CALLBACK DE DESCONEXÃO
# ==========================================

def ao_desconectar(
    client,
    userdata,
    disconnect_flags,
    reason_code,
    properties
):

    print(
        f"[MQTT] Desconectado do HiveMQ. Código: {reason_code}"
    )

    mqtt_conectado.clear()


mqtt_client.on_disconnect = ao_desconectar


# ==========================================
# CONECTAR AO HIVEMQ
# ==========================================

print("======================================")
print("CONECTANDO AO HIVEMQ")
print("======================================")

print(
    f"[MQTT] Host: {MQTT_HOST}"
)

print(
    f"[MQTT] Porta: {MQTT_PORT}"
)

print(
    f"[MQTT] Usuário: {MQTT_USER}"
)

try:

    mqtt_client.connect(
        MQTT_HOST,
        MQTT_PORT,
        keepalive=60
    )

except Exception as erro:

    print("======================================")
    print("[MQTT] ERRO AO CONECTAR")
    print("======================================")
    print(erro)

    raise


# Inicia o processamento MQTT em segundo plano

mqtt_client.loop_start()


# ==========================================
# ESPERAR CONEXÃO
# ==========================================

print("[MQTT] Aguardando conexão...")


if not mqtt_conectado.wait(timeout=15):

    mqtt_client.loop_stop()

    raise RuntimeError(
        "Não foi possível conectar ao HiveMQ em 15 segundos."
    )


print("[MQTT] Conexão confirmada.")
print()


# ==========================================
# ENVIO DO GESTO
# ==========================================

ultimo_envio = 0

COOLDOWN = 2.0


def enviar_gesto(gesto):

    global ultimo_envio

    # --------------------------------------
    # Verificar conexão
    # --------------------------------------

    if not mqtt_conectado.is_set():

        print(
            "[MQTT] Não conectado. Gesto não enviado."
        )

        return False

    # --------------------------------------
    # Cooldown
    # --------------------------------------

    agora = time.time()

    if agora - ultimo_envio < COOLDOWN:

        return False

    # --------------------------------------
    # Criar mensagem
    # --------------------------------------

    payload = {
        "tipo": "GESTO_VISAO",
        "gesto": gesto
    }

    mensagem = json.dumps(
        payload,
        ensure_ascii=False
    )

    print(
        f"[MQTT] Publicando no tópico: {MQTT_TOPIC}"
    )

    print(
        f"[MQTT] Mensagem: {mensagem}"
    )

    # --------------------------------------
    # Publicar
    # --------------------------------------

    resultado = mqtt_client.publish(
        MQTT_TOPIC,
        mensagem,
        qos=1
    )

    # --------------------------------------
    # Verificar publicação
    # --------------------------------------

    if resultado.rc != mqtt.MQTT_ERR_SUCCESS:

        print(
            f"[MQTT] ERRO AO PUBLICAR. Código: {resultado.rc}"
        )

        return False

    # --------------------------------------
    # Aguardar confirmação do envio
    # --------------------------------------

    try:

        resultado.wait_for_publish(timeout=5)

    except Exception as erro:

        print(
            f"[MQTT] Erro aguardando publicação: {erro}"
        )

        return False

    # --------------------------------------
    # Sucesso
    # --------------------------------------

    print(
        "[MQTT] MENSAGEM ENVIADA COM SUCESSO!"
    )

    print()

    ultimo_envio = agora

    return True


# ==========================================
# MEDIAPIPE
# ==========================================

mp_hands = mp.solutions.hands

mp_drawing = mp.solutions.drawing_utils


hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6
)


# ==========================================
# CÂMERA
# ==========================================

cap = cv2.VideoCapture(
    CAMERA_INDEX
)


if not cap.isOpened():

    mqtt_client.loop_stop()
    mqtt_client.disconnect()

    raise RuntimeError(
        "Não foi possível abrir a câmera."
    )


print("======================================")
print("SOLDATECH - VISAO COMPUTACIONAL")
print("======================================")
print("MQTT conectado.")
print("Câmera aberta.")
print()
print("PALMA  = START")
print("PUNHO  = PAUSA")
print()
print("Pressione Q para sair.")
print("======================================")


# ==========================================
# CLASSIFICAÇÃO DO GESTO
# ==========================================

def classificar_gesto(hand_landmarks):

    landmarks = hand_landmarks.landmark

    dedos_estendidos = 0

    # --------------------------------------
    # Indicador
    # --------------------------------------

    if landmarks[8].y < landmarks[6].y:

        dedos_estendidos += 1

    # --------------------------------------
    # Médio
    # --------------------------------------

    if landmarks[12].y < landmarks[10].y:

        dedos_estendidos += 1

    # --------------------------------------
    # Anelar
    # --------------------------------------

    if landmarks[16].y < landmarks[14].y:

        dedos_estendidos += 1

    # --------------------------------------
    # Mínimo
    # --------------------------------------

    if landmarks[20].y < landmarks[18].y:

        dedos_estendidos += 1

    # --------------------------------------
    # PALMA ABERTA
    # --------------------------------------

    if dedos_estendidos == 4:

        return "PALMA"

    # --------------------------------------
    # PUNHO FECHADO
    # --------------------------------------

    if dedos_estendidos == 0:

        return "PUNHO"

    # --------------------------------------
    # OUTRO
    # --------------------------------------

    return "NEUTRO"


# ==========================================
# LOOP PRINCIPAL
# ==========================================

ultimo_gesto = "NEUTRO"


while True:

    # --------------------------------------
    # Capturar câmera
    # --------------------------------------

    ok, frame = cap.read()


    if not ok:

        print(
            "[CAMERA] Erro ao capturar imagem."
        )

        break


    # --------------------------------------
    # Espelhar imagem
    # --------------------------------------

    frame = cv2.flip(
        frame,
        1
    )


    # --------------------------------------
    # BGR -> RGB
    # --------------------------------------

    frame_rgb = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )


    # --------------------------------------
    # MediaPipe
    # --------------------------------------

    resultado = hands.process(
        frame_rgb
    )


    # --------------------------------------
    # Estado inicial
    # --------------------------------------

    gesto = "NEUTRO"

    texto = "NENHUMA MAO"


    # ======================================
    # DETECTAR MÃO
    # ======================================

    if resultado.multi_hand_landmarks:

        for hand_landmarks in resultado.multi_hand_landmarks:

            # Desenhar mão

            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS
            )

            # Classificar

            gesto = classificar_gesto(
                hand_landmarks
            )


        texto = gesto


    # ======================================
    # DETECTAR MUDANÇA DE GESTO
    # ======================================

    if gesto != ultimo_gesto:


        # ==================================
        # PALMA = START
        # ==================================

        if gesto == "PALMA":

            print(
                "[VISÃO] PALMA DETECTADA"
            )

            print(
                "[AÇÃO] START"
            )

            enviar_gesto(
                "START"
            )


        # ==================================
        # PUNHO = PAUSA
        # ==================================

        elif gesto == "PUNHO":

            print(
                "[VISÃO] PUNHO DETECTADO"
            )

            print(
                "[AÇÃO] PAUSA"
            )

            enviar_gesto(
                "PAUSA"
            )


        # ==================================
        # NEUTRO
        # ==================================

        elif gesto == "NEUTRO":

            print(
                "[VISÃO] NEUTRO"
            )


        # Guardar estado

        ultimo_gesto = gesto


    # ======================================
    # TEXTO NA CÂMERA
    # ======================================

    cv2.putText(
        frame,
        texto,
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )


    # ======================================
    # MOSTRAR CÂMERA
    # ======================================

    cv2.imshow(
        "SoldaTech - Visao Computacional",
        frame
    )


    # ======================================
    # SAIR
    # ======================================

    tecla = cv2.waitKey(1) & 0xFF


    if (
        tecla == ord("q")
        or tecla == ord("Q")
        or tecla == 27
    ):

        print()
        print(
            "Saindo da visão computacional..."
        )

        break


# ==========================================
# ENCERRAMENTO
# ==========================================

print()
print("Encerrando...")


cap.release()

cv2.destroyAllWindows()

hands.close()

mqtt_client.loop_stop()

mqtt_client.disconnect()

print("Programa encerrado.")