import {
  solution,
  format,
  readingFor,
  storedEnergy,
} from "~/state/circuit/formulas";
import { Show } from "solid-js";
import type { Part } from "~/state/circuit/data";

const Measurements = (props: { part: Part }) => {
  const reading = () => readingFor(solution(), props.part.id);

  return (
    <>
      <div class="readout-grid">
        <div>
          <span>Voltage drop · A − B</span>
          <strong>{format(reading()?.voltage, "V")}</strong>
        </div>
        <div>
          <span>Current · A → B</span>
          <strong>{format(reading()?.current, "A")}</strong>
        </div>
      </div>
      <dl class="measurements">
        <div>
          <dt>Terminal A</dt>
          <dd>{format(reading()?.a, "V")}</dd>
        </div>
        <div>
          <dt>Terminal B</dt>
          <dd>{format(reading()?.b, "V")}</dd>
        </div>
        <div>
          <dt>
            {(reading()?.power ?? 0) < 0 ? "Power supplied" : "Power absorbed"}
          </dt>
          <dd>{format(Math.abs(reading()?.power ?? NaN), "W")}</dd>
        </div>
        <Show when={props.part.kind === "capacitor"}>
          <div>
            <dt>Charge on A · CV</dt>
            <dd>
              {format(
                reading() ? props.part.value * reading()!.voltage : undefined,
                "C",
              )}
            </dd>
          </div>
          <div>
            <dt>Stored energy · ½CV²</dt>
            <dd>{format(storedEnergy(props.part, reading()), "J")}</dd>
          </div>
        </Show>
      </dl>
    </>
  );
};

export default Measurements;
