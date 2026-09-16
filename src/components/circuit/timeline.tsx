import { Show } from "solid-js";
import { analysisMode, playback } from "~/state/circuit/data";
import {
  chooseAnalysis,
  seekTime,
  togglePlayback,
  changeSpeed,
} from "~/state/circuit/actions";
import { analysisLabel, simulationTime } from "~/state/circuit/formulas";

const Timeline = () => (
  <section class="timeline" aria-label="Analysis and time">
    <label>
      Analysis
      <select
        value={analysisMode()}
        onChange={(e) =>
          chooseAnalysis(e.currentTarget.value as "dc" | "transient")
        }
      >
        <option value="transient">Transient from initial voltages</option>
        <option value="dc">DC equilibrium</option>
      </select>
    </label>
    <Show when={analysisMode() === "transient"}>
      <button onClick={togglePlayback}>
        {playback().running ? "Pause" : "Play"}
      </button>
      <strong aria-live="off">{analysisLabel()}</strong>
      <label>
        Speed ×
        <input
          aria-label="Playback speed"
          type="number"
          min="0.000001"
          step="any"
          value={playback().speed}
          onChange={(e) => changeSpeed(e.currentTarget.valueAsNumber)}
        />
      </label>
      <label>
        Go to time (s)
        <input
          aria-label="Requested time"
          disabled={playback().running}
          type="number"
          min="0"
          step="any"
          value={simulationTime()}
          onChange={(e) => seekTime(e.currentTarget.valueAsNumber)}
        />
      </label>
      <button onClick={() => seekTime(0)}>Return to t = 0</button>
      <p>
        Initial voltage defaults to 0 V. Sources and switch positions apply from
        t = 0. Edits recompute the entire experiment.
      </p>
    </Show>
  </section>
);

export default Timeline;
