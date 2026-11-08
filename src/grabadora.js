// Grabación de audio de los ensayos (MediaRecorder). El audio no sale del dispositivo.

export const puedeGrabar = () =>
  typeof window !== "undefined" && "MediaRecorder" in window && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

function tipoAudio() {
  const tipos = ["audio/mp4", "audio/mp4;codecs=mp4a.40.2", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  if (!window.MediaRecorder.isTypeSupported) return "";
  return tipos.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch { return false; } }) || "";
}

export const extensionDe = (mime) => (/mp4|aac|m4a/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "webm");

export function crearGrabadora() {
  let rec = null, stream = null, trozos = [], mime = "", parada = null;
  const soltar = () => { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; };
  return {
    get activa() { return !!rec && rec.state !== "inactive"; },
    get mime() { return mime; },
    async empezar() {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      const tipo = tipoAudio();
      const opciones = { audioBitsPerSecond: 64000 };
      if (tipo) opciones.mimeType = tipo;
      try { rec = new MediaRecorder(stream, opciones); }
      catch { rec = new MediaRecorder(stream); }
      mime = rec.mimeType || tipo || "audio/mp4";
      trozos = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) trozos.push(e.data); };
      parada = new Promise((resolve) => { rec.onstop = () => resolve(); });
      rec.start(1000);
    },
    pausar() { try { if (rec && rec.state === "recording") rec.pause(); } catch {} },
    seguir() { try { if (rec && rec.state === "paused") rec.resume(); } catch {} },
    /** Detiene y devuelve el audio (Blob) o null. */
    async terminar() {
      if (!rec) { soltar(); return null; }
      const r = rec; rec = null;
      try { if (r.state !== "inactive") { r.stop(); await parada; } } catch {}
      soltar();
      return trozos.length ? new Blob(trozos, { type: mime }) : null;
    },
    cancelar() {
      const r = rec; rec = null;
      try { if (r && r.state !== "inactive") r.stop(); } catch {}
      trozos = [];
      soltar();
    },
  };
}
