export const listenForKeys = (handler: (event: KeyboardEvent) => void) => {
  window.addEventListener("keydown", handler);

  return () => window.removeEventListener("keydown", handler);
};

export const pinAt = (x: number, y: number) =>
  document
    .elementFromPoint(x, y)
    ?.closest("[data-pin]")
    ?.getAttribute("data-pin");
