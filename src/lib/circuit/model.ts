/** SI units throughout. Branch current is positive from pin a to pin b. */
export type Equation = {
  id: string;
  a: string;
  b: string;
  /** sum(voltage[pin] * Vpin) + current * Ibranch = rhs */
  voltage: Readonly<Record<string, number>>;
  current: number;
  rhs: number;
};

export type Analysis = { mode: "dc" } | { mode: "snapshot"; time: number };

export type Context = {
  analysis: Analysis;
  voltage: (pin: string) => number;
};

/** Pure model contract. Multiple equations/pins support composite and controlled devices.
 * Nonlinear models return a local linearization; the engine verifies the final equations.
 * Dynamic devices must reject unsupported analyses, never silently assume equilibrium.
 */
export type Component = {
  id: string;
  capacitor?: { capacitance: number; initialVoltage: number };
  pins: Readonly<Record<string, string>>;
  validate: (analysis: Analysis) => readonly string[];
  equations: (context: Context) => readonly Equation[];
};

export type Diagnostic = {
  code: "invalid" | "singular" | "numerical" | "convergence" | "model";
  message: string;
  component?: string;
};

export type BranchReading = {
  a: number;
  b: number;
  voltage: number;
  current: number;
  power: number;
};

export type Observation = {
  pins: Record<string, { node: string; voltage: number; current: number }>;
  branches: Record<string, BranchReading>;
};

export type Snapshot = {
  analysis: Analysis;
  reference?: string;
  nodes: Record<string, number>;
  components: Record<string, Observation>;
  diagnostics: Diagnostic[];
};
