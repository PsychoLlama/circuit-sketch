import { Show } from "solid-js";
import type { Kind } from "~/lib/circuit/solver";

const Symbol = (props: { kind: Kind; closed?: boolean }) => {
  return (
    <g
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <Show when={props.kind === "resistor"}>
        <path d="M-48 0H-30l5-10 10 20 10-20 10 20 10-20 10 20 5-10H48" />
      </Show>
      <Show when={props.kind === "source"}>
        <path d="M-48 0H-18M18 0H48" />
        <circle r="18" />
        <path d="M-12 0h8m-4-4v8M5 0h8" />
      </Show>
      <Show when={props.kind === "capacitor"}>
        <path d="M-48 0H-6M6 0H48M-6-18v36M6-18v36" />
      </Show>
      <Show when={props.kind === "switch"}>
        <path d={`M-48 0H-20M20 0H48M-18 0L18 ${props.closed ? 0 : -22}`} />
        <circle cx="-20" r="3" />
        <circle cx="20" r="3" />
      </Show>
      <Show when={props.kind === "wire"}>
        <path d="M-45 10H-10V-10H45" />
        <circle cx="-45" cy="10" r="3" />
        <circle cx="45" cy="-10" r="3" />
      </Show>
    </g>
  );
};

export default Symbol;
