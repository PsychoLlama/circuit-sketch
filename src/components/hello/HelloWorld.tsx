import { createHelloActions } from "~/state/hello/actions";

export default function HelloWorld() {
  const hello = createHelloActions();

  return (
    <main class="grid min-h-screen place-items-center bg-slate-950 px-6 text-slate-100">
      <section class="w-full max-w-lg space-y-6">
        <p class="text-sm font-medium uppercase tracking-widest text-amber-300">
          Electricity Explainer
        </p>
        <h1 class="text-5xl font-semibold tracking-tight">Hello, world!</h1>
        <p class="text-lg text-slate-300" aria-live="polite">
          {hello.message()}
        </p>
        <button
          type="button"
          class="rounded-lg bg-amber-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-amber-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
          onClick={hello.greet}
        >
          Say hello
        </button>
      </section>
    </main>
  );
}
