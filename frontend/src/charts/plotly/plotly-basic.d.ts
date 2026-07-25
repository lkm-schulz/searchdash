// `plotly.js-basic-dist-min` ships no type declarations. Its public surface is a
// subset of the full Plotly API, so we alias it to the `@types/plotly.js`
// definitions installed as a dev dependency.
declare module "plotly.js-basic-dist-min" {
  import Plotly from "plotly.js";
  export = Plotly;
}
