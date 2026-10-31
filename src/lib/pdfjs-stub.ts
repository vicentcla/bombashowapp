// Stub exclusivo del bundle SSR: pdfjs-dist solo se carga en el navegador
// (import dinámico dentro de useEffect en NativeScore). Si alguna vez se
// ejecutara en el servidor, falla de forma explícita en lugar de silenciosa.
const unavailable = () => {
  throw new Error("pdfjs-dist solo está disponible en el cliente");
};

export const GlobalWorkerOptions = { workerSrc: "" };
export const getDocument = unavailable;
export default new Proxy(
  {},
  {
    get: unavailable,
  },
);
