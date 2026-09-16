export const listenForKeys = (handler: (event: KeyboardEvent) => void) => {
  window.addEventListener("keydown", handler);

  return () => window.removeEventListener("keydown", handler);
};

export const pinAt = (x: number, y: number, exclude?: string) =>
  document
    .elementsFromPoint(x, y)
    .map((element) => element.closest("[data-pin]")?.getAttribute("data-pin"))
    .find((node) => node && node !== exclude);

export const observeCanvas = (
  canvas: SVGSVGElement,
  resize: (size: { width: number; height: number }) => void,
) => {
  const measure = () => {
    const { width, height } = canvas.getBoundingClientRect();

    resize({ width, height });
  };

  const observer = new ResizeObserver(measure);

  observer.observe(canvas);
  measure();

  return () => observer.disconnect();
};

const storageKey = "current.circuit.v1";

export const readCircuit = () => {
  try {
    return window.localStorage.getItem(storageKey);
  } catch {
    return null;
  }
};

export const writeCircuit = (value: string) => {
  try {
    window.localStorage.setItem(storageKey, value);
  } catch {
    // Editing remains available when browser storage is unavailable or full.
  }
};
