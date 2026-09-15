import { For } from "solid-js";
import type { Lab } from "~/state/circuit/actions";
import { catalog } from "~/state/circuit/formulas";
import Symbol from "./Symbol";

const Library = (props: { lab: Lab }) => {
  const lab = props.lab;

  return (
    <aside class="library">
      <div class="panel-heading">
        COMPONENTS <span>05</span>
      </div>
      <div class="library-intro">Pick a part. Place it. Connect it.</div>
      <For each={catalog}>
        {(c) => (
          <button
            class={`part-button ${lab.tool() === c.kind ? "active" : ""}`}
            onClick={() => lab.choose(c.kind)}
          >
            <svg viewBox="-55 -30 110 60">
              <Symbol kind={c.kind} closed={false} />
            </svg>
            <span>
              {c.name}
              <small>{c.description}</small>
            </span>
            <kbd>{c.key}</kbd>
          </button>
        )}
      </For>
      <div class="library-section">
        <span class="eyebrow">START WITH AN EXPERIMENT</span>
        <button class="experiment" onClick={() => lab.example("series")}>
          <span>01</span>
          <div>
            A complete circuit<small>Source → resistor → switch</small>
          </div>
          <b>↗</b>
        </button>
        <button class="experiment" onClick={() => lab.example("divider")}>
          <span>02</span>
          <div>
            Divide the voltage<small>Two resistors, one source</small>
          </div>
          <b>↗</b>
        </button>
        <button class="experiment" onClick={() => lab.example("parallel")}>
          <span>03</span>
          <div>
            Follow the branches<small>Where does current go?</small>
          </div>
          <b>↗</b>
        </button>
        <button class="experiment" onClick={() => lab.example("capacitor")}>
          <span>04</span>
          <div>
            A settled capacitor<small>Voltage without current</small>
          </div>
          <b>↗</b>
        </button>
        <p class="fine">
          Experiments replace the canvas. Undo brings your circuit back.
        </p>
      </div>
      <div class="library-bottom">
        <span class="eyebrow">THE USEFUL EQUATION</span>
        <div class="equation">
          V <span>=</span> I <span>×</span> R
        </div>
        <p>
          Change one thing.
          <br />
          See what happens to the rest.
        </p>
      </div>
    </aside>
  );
};

export default Library;
