import { Show } from "solid-js";
import type { Lab } from "~/state/circuit/actions";
import { partValue, hoverPosition } from "~/state/circuit/formulas";
import Measurements from "./Measurements";

const HoverCard = (props: { lab: Lab }) => {
  const lab = props.lab;

  return (
    <Show when={!lab.drag() && lab.hovered()}>
      {(p) => (
        <div class="hover-card" style={hoverPosition(lab.hover()!)}>
          <div class="hover-title">
            {p().id}
            <span>{partValue(p())}</span>
          </div>
          <Measurements lab={lab} part={p()} />
          <p class="fine">
            {lab.solution().error
              ? "Readings unavailable: resolve the circuit diagnostic."
              : "Click to inspect · A → B sign convention"}
          </p>
        </div>
      )}
    </Show>
  );
};

export default HoverCard;
