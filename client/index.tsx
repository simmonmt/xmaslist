import * as React from "react";
import * as ReactDOM from "react-dom";
import { List } from "../proto/list_pb";
import App from "./app";

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

let list = new List();
console.log(list);
