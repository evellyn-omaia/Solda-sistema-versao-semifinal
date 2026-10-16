import { classificarResultado, FiltroGestos } from "./visao-core.mjs";

export function mensagemErroCamera(erro) {
  return (
    {
      NotAllowedError:
        "Acesso à câmera negado. Autorize a câmera nas configurações do navegador e tente novamente.",
      NotFoundError: "Nenhuma câmera disponível neste dispositivo.",
      NotReadableError:
        "Câmera ocupada ou indisponível. Feche outros aplicativos que estejam usando a câmera.",
      OverconstrainedError:
        "Esta câmera não suporta a configuração solicitada.",
      SecurityError: "Abra o SoldaTouch por HTTPS para utilizar a câmera.",
    }[erro?.name] ||
    erro?.message ||
    "Não foi possível preparar a câmera e o reconhecimento. Tente novamente."
  );
}

export async function criarReconhecedor() {
  try {
    const { FilesetResolver, GestureRecognizer } =
      await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/vision_bundle.mjs");
    const arquivos = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21/wasm",
    );
    return await GestureRecognizer.createFromOptions(arquivos, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  } catch (causa) {
    throw new Error(
      `Falha ao carregar o MediaPipe: ${causa.message || causa}. Verifique a internet e toque em Ativar câmera para tentar novamente.`,
    );
  }
}

export class CameraGestos {
  constructor({
    video,
    mediaDevices,
    criarModelo = criarReconhecedor,
    quadro = (callback) => requestAnimationFrame(callback),
    cancelar = (id) => cancelAnimationFrame(id),
    relogio = () => performance.now(),
    aoEstado = () => {},
    aoResultado = () => {},
    aoGesto = () => {},
    contextoSeguro = globalThis.isSecureContext,
  }) {
    Object.assign(this, {
      video,
      mediaDevices,
      criarModelo,
      quadro,
      cancelar,
      relogio,
      aoEstado,
      aoResultado,
      aoGesto,
      contextoSeguro,
    });
    this.filtro = new FiltroGestos();
    this.geracao = 0;
    this.lado = "user";
    this.ativa = false;
    this.preparando = false;
  }
  async iniciar(lado = this.lado) {
    if (this.preparando || this.ativa) return;
    if (!this.contextoSeguro || !this.mediaDevices?.getUserMedia) {
      this.aoEstado(
        "erro",
        "Câmera não suportada. Use um navegador compatível por HTTPS (ou localhost no computador).",
      );
      return;
    }
    const geracao = ++this.geracao;
    this.preparando = true;
    this.lado = lado;
    this.aoEstado(
      "preparando",
      "Autorize a câmera. Preparando reconhecimento...",
    );
    let stream, modelo;
    try {
      stream = await this.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: lado },
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 15, max: 24 },
        },
      });
      if (geracao !== this.geracao) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (geracao !== this.geracao) return;
      modelo = await this.criarModelo();
      if (geracao !== this.geracao) {
        modelo.close();
        return;
      }
      this.modelo = modelo;
      this.ativa = true;
      this.preparando = false;
      this.ultimoVideo = -1;
      this.ultimoProcessamento = -Infinity;
      this.intervalo = 100;
      this.filtro.reiniciar(Boolean(this.jaIniciou));
      this.jaIniciou = true;
      stream.getVideoTracks().forEach((track) =>
        track.addEventListener("ended", () => {
          if (geracao === this.geracao)
            this.parar("A câmera foi desconectada. Toque em Ativar câmera.");
        }),
      );
      this.aoEstado(
        "ativa",
        "Câmera ativa. Mantenha uma mão visível e o gesto por pelo menos 0,6 segundo.",
      );
      this.processar(geracao);
    } catch (erro) {
      if (geracao !== this.geracao) return;
      this.parar();
      this.aoEstado("erro", mensagemErroCamera(erro));
    }
  }
  processar(geracao) {
    if (!this.ativa || geracao !== this.geracao) return;
    try {
      const agora = this.relogio();
      if (
        this.video.readyState >= 2 &&
        this.video.currentTime !== this.ultimoVideo &&
        agora - this.ultimoProcessamento >= this.intervalo
      ) {
        this.ultimoVideo = this.video.currentTime;
        this.ultimoProcessamento = agora;
        const resultado = this.modelo.recognizeForVideo(this.video, agora);
        this.intervalo = Math.max(100, (this.relogio() - agora) * 2);
        // A inferência em CPU lenta não deve reiniciar continuamente a estabilidade.
        this.filtro.intervaloMaximo = Math.max(400, Math.min(2000, this.intervalo * 2.5));
        const gesto = classificarResultado(resultado);
        this.aoResultado(gesto, resultado);
        const intencao = this.filtro.atualizar(gesto, agora);
        if (intencao) this.aoGesto(intencao);
      }
      if (this.ativa && geracao === this.geracao)
        this.frame = this.quadro(() => this.processar(geracao));
    } catch {
      this.parar();
      this.aoEstado(
        "erro",
        "O reconhecimento falhou. Toque em Ativar câmera para reiniciar.",
      );
    }
  }
  parar(mensagem = "Câmera encerrada. Toque em Ativar câmera para continuar.") {
    ++this.geracao;
    this.ativa = false;
    this.preparando = false;
    if (this.frame != null) this.cancelar(this.frame);
    this.frame = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.video.pause();
    this.video.srcObject = null;
    try {
      this.modelo?.close();
    } catch {
      /* As tracks já foram encerradas. */
    }
    this.modelo = null;
    this.filtro.reiniciar();
    this.aoResultado("SEM_MAO", {});
    this.aoEstado("parada", mensagem);
  }
  async alternar() {
    const lado = this.lado === "user" ? "environment" : "user";
    this.parar();
    await this.iniciar(lado);
  }
}
