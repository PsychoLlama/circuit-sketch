import { For } from "solid-js";
import type { Lab } from "~/state/circuit/actions";
import { componentCatalog } from "~/state/circuit/formulas";
import Symbol from "./Symbol";

const Library = (props: { lab: Lab }) => {
  const lab = props.lab;

  return (
    <aside class="library">
      <div class="panel-heading">
        COMPONENTS{" "}
        <span>{String(componentCatalog.length).padStart(2, "0")}</span>
      </div>
      <For each={componentCatalog}>
        {(c) => (
          <button
            class={`part-button ${lab.tool() === c.kind ? "active" : ""}`}
            onClick={() => lab.choose(c.kind)}
            draggable={true}
            title={c.description}
            onDragStart={(e) => lab.libraryDrag(e, c.kind)}
          >
            <svg viewBox="-55 -30 110 60">
              <Symbol kind={c.kind} closed={false} />
            </svg>
            <span>{c.name}</span>
            <kbd>{c.key}</kbd>
          </button>
        )}
      </For>
      <p class="connection-hint">Drag between pins to connect components.</p>
      <div class="library-section">
        <span class="eyebrow">EXAMPLES</span>
        <button class="experiment" onClick={() => lab.example("series")}>
          <span>01</span>
          <div>Series circuit</div>
          <b>↗</b>
        </button>
        <button class="experiment" onClick={() => lab.example("divider")}>
          <span>02</span>
          <div>Voltage divider</div>
          <b>↗</b>
        </button>
        <button class="experiment" onClick={() => lab.example("parallel")}>
          <span>03</span>
          <div>Parallel resistors</div>
          <b>↗</b>
        </button>
        <button class="experiment" onClick={() => lab.example("capacitor")}>
          <span>04</span>
          <div>Capacitor</div>
          <b>↗</b>
        </button>
        <button class="experiment" onClick={() => lab.example("led")}>
          <span>05</span>
          <div>LED + resistor</div>
          <b>↗</b>
        </button>
      </div>
    </aside>
  );
};

export default Library;
