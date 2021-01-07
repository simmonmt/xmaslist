import * as React from "react";
import * as ReactDOM from "react-dom";
import App from "./app";
import {proto} from "../proto/tire";

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

console.log(new proto.Tire());
